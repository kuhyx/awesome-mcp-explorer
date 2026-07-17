#!/bin/bash

# ============================================================================
# awesome-mcp-explorer — install everything, then open the site in a browser.
#
#   ./run.sh              install if needed, serve, open browser
#   ./run.sh --refresh    also rebuild servers.json from the live sources first
#   ./run.sh --build      serve the production build instead of the dev server
#   ./run.sh --port 5180  use a different port
#   ./run.sh --no-open    do not launch a browser (for headless/CI use)
# ============================================================================

set -euo pipefail

# Assigned separately from `readonly` so a failure in the subshell is not masked
# by readonly's own exit status (shellcheck SC2155).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
readonly REQUIRED_NODE_MAJOR=24

PORT=5178
REFRESH_DATA=false
PRODUCTION_BUILD=false
OPEN_BROWSER=true
SERVER_PID=""
COREPACK_SHIM_DIR=""

cleanup() {
    if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
        echo ""
        echo "Stopping server (pid $SERVER_PID)..."
        kill "$SERVER_PID" 2>/dev/null || true
        wait "$SERVER_PID" 2>/dev/null || true
    fi
    if [[ -n "$COREPACK_SHIM_DIR" && -d "$COREPACK_SHIM_DIR" ]]; then
        rm -rf "$COREPACK_SHIM_DIR"
    fi
}

trap cleanup EXIT INT TERM

usage() {
    sed -n '3,12p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
}

die() {
    echo "Error: $1" >&2
    exit 1
}

# --- node --------------------------------------------------------------------
#
# The floor is node 24: the codebase uses Error.isError, which needs V8 13.6+.
#
# A too-old `node` on PATH is the normal case, not the broken one. nvm pins one
# version per shell and it is routinely older than what the machine already has
# sitting on disk — so refusing to start because `node -v` says 22, while a 24
# and a 26 are both installed, is a bug in this script rather than a problem
# with the machine. Look at every node on the box first; install only when none
# of them qualifies.

# Prints a node binary's major version, or 0 if it is missing or will not run.
node_major_of() {
    local binary="$1"
    [[ -x "$binary" ]] || { echo 0; return; }
    "$binary" -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0
}

# Every node this machine has, version-manager copies first and newest-first
# within them, so an nvm-managed 24 wins over a distro 26 only by being listed
# first — both satisfy the floor and either is fine.
list_node_candidates() {
    local bin
    for bin in "${NVM_DIR:-${HOME}/.nvm}/versions/node"/*/bin \
               "${HOME}/.local/share/fnm/node-versions"/*/installation/bin; do
        [[ -x "${bin}/node" ]] && printf '%s\n' "${bin}/node"
    done | sort -Vr

    command -v node 2>/dev/null || true
    printf '%s\n' /usr/local/bin/node /usr/bin/node
}

# Echoes the first candidate meeting the floor; non-zero exit when there is none.
find_usable_node() {
    local candidate
    while IFS= read -r candidate; do
        if (( $(node_major_of "$candidate") >= REQUIRED_NODE_MAJOR )); then
            printf '%s\n' "$candidate"
            return 0
        fi
    done < <(list_node_candidates)
    return 1
}

# Puts the chosen node ahead of whatever the shell had, for this run only. The
# user's nvm default and system packages are deliberately left alone: running a
# dev server is no reason to repoint someone's toolchain.
use_node() {
    local binary="$1"
    PATH="$(dirname "$binary"):${PATH}"
    export PATH
    hash -r 2>/dev/null || true
    echo "==> Using node $("$binary" -v) — ${binary}"
}

install_node_via_nvm() {
    local nvm_sh="${NVM_DIR:-${HOME}/.nvm}/nvm.sh"
    [[ -s "$nvm_sh" ]] || die "no node >= ${REQUIRED_NODE_MAJOR} and no nvm to install one with. Install nvm (https://github.com/nvm-sh/nvm) or run: sudo pacman -S nodejs"

    echo "==> No node >= ${REQUIRED_NODE_MAJOR} found; installing the latest LTS via nvm"
    # nvm is a shell function, so it exists only after sourcing — there is no
    # binary to call. `set -u` is lifted across the source because nvm.sh reads
    # several variables it does not itself define.
    set +u
    # shellcheck source=/dev/null
    . "$nvm_sh"
    nvm install --lts
    set -u
}

check_node() {
    local binary
    if binary="$(find_usable_node)"; then
        use_node "$binary"
        return
    fi

    install_node_via_nvm
    binary="$(find_usable_node)" \
        || die "nvm install --lts finished but still no node >= ${REQUIRED_NODE_MAJOR}"
    use_node "$binary"
}

# --- dependency checks -------------------------------------------------------
#
# pnpm ships with Node's corepack, and the project's own dependencies are
# installed below without asking.

# pnpm's version is pinned by package.json's `packageManager` field and honoured
# through corepack, so the version here is identical to CI's. This is not
# fussiness: node_modules records which pnpm installed it, and a different
# *major* (a stray corepack default of 11.x, or a global install) refuses to
# reuse the directory and aborts wanting to purge it -- the
# ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY that bites when a wrong-major pnpm
# happens to sit first on PATH. Routing through corepack removes the guesswork:
# whatever is on PATH, the pinned version is what runs.
setup_pnpm() {
    command -v corepack >/dev/null 2>&1 \
        || die "corepack not found; it ships with Node >= ${REQUIRED_NODE_MAJOR}. Reinstall Node, or: npm install -g pnpm@10"

    # A run-scoped shim dir, prepended to PATH. Writing the shim here rather
    # than into a Node bin means we never need write access to a system Node
    # under /usr, and never mutate the user's global corepack state. The shim is
    # corepack's dispatcher, which reads `packageManager` and runs exactly that
    # version, shadowing any standalone pnpm further down PATH.
    COREPACK_SHIM_DIR="$(mktemp -d)"
    corepack enable --install-directory "$COREPACK_SHIM_DIR" pnpm \
        || die "could not enable pnpm via corepack"
    PATH="${COREPACK_SHIM_DIR}:${PATH}"
    export PATH
    hash -r 2>/dev/null || true

    # Fetch the pinned version now so the first real command is not silently
    # downloading mid-install. The env var keeps that download non-interactive
    # (no "Is it ok to download pnpm@x?" prompt to hang an unattended run).
    export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
    corepack install >/dev/null 2>&1 || true
    echo "==> Using pnpm $(pnpm --version) (pinned in package.json)"
}

install_dependencies() {
    echo "==> Installing dependencies"
    # --prefer-offline keeps a re-run fast when nothing changed.
    pnpm install --prefer-offline
}

# --- data --------------------------------------------------------------------

ensure_dataset() {
    local dataset="${SCRIPT_DIR}/public/servers.json"

    if [[ "$REFRESH_DATA" == true ]]; then
        echo "==> Rebuilding servers.json from the live sources"
        echo "    (~2,981 GitHub repos + ~2,981 Glama badges; cached, so a"
        echo "     re-run is fast. The first run takes several minutes.)"
        pnpm run build:data
        return
    fi

    if [[ ! -f "$dataset" ]]; then
        echo "==> servers.json is missing; building it now"
        echo "    This is a one-off and takes a few minutes."
        pnpm run build:data
        return
    fi

    local age_days
    age_days=$(( ( $(date +%s) - $(stat -c %Y "$dataset") ) / 86400 ))
    echo "==> Using the committed servers.json (${age_days}d old; --refresh to rebuild)"
}

# --- serving -----------------------------------------------------------------

wait_for_server() {
    local url="$1"
    local attempt=0

    echo -n "==> Waiting for the server"
    while (( attempt < 60 )); do
        if curl -sf -o /dev/null "$url"; then
            echo " ready"
            return 0
        fi
        echo -n "."
        sleep 0.5
        # An assignment, not `(( attempt++ ))`: an arithmetic command returns
        # exit status 1 when its expression evaluates to zero, and post-increment
        # yields the *old* value — so the first iteration returned 1 and
        # `set -e` killed the script before the server ever came up.
        attempt=$(( attempt + 1 ))
    done
    echo ""
    die "server did not come up at ${url}"
}

open_browser() {
    local url="$1"
    [[ "$OPEN_BROWSER" == true ]] || return 0

    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$url" >/dev/null 2>&1 &
    else
        echo "    (no xdg-open; open ${url} yourself)"
    fi
}

serve() {
    local url="http://localhost:${PORT}/"

    if [[ "$PRODUCTION_BUILD" == true ]]; then
        echo "==> Building for production"
        pnpm run build
        pnpm exec vite preview --port "$PORT" --strictPort &
    else
        pnpm exec vite --port "$PORT" --strictPort &
    fi
    SERVER_PID=$!

    wait_for_server "$url"

    cat <<EOF

============================================================================
  MCP Explorer is running at ${url}

  Try:
    ${url}?aaa=1                                  triple-A only
    ${url}?aaa=1&foss=yes&scope=local             + FOSS + local
    ${url}?aaa=1&scope=local,!cloud&lang=rust     + Rust, excluding cloud

  Keys:  /  search    a  toggle triple-A    ?  help    Esc  close

  Every filter lives in the URL, so the address bar is always a shareable
  link. Cost and rate-limit chips are marked ~ because they are inferred,
  not published — correct them in data/overrides.json.

  Ctrl-C to stop.
============================================================================

EOF

    open_browser "$url"
    wait "$SERVER_PID"
}

main() {
    cd "$SCRIPT_DIR"

    check_node
    setup_pnpm
    install_dependencies
    ensure_dataset
    serve
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --refresh)
            REFRESH_DATA=true
            shift
            ;;
        --build)
            PRODUCTION_BUILD=true
            shift
            ;;
        --no-open)
            OPEN_BROWSER=false
            shift
            ;;
        --port)
            [[ -n "${2:-}" ]] || die "--port needs a number"
            PORT="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            die "unknown option: $1 (try --help)"
            ;;
    esac
done

main "$@"
