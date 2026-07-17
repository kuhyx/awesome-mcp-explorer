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
readonly REQUIRED_NODE_MAJOR=22

PORT=5178
REFRESH_DATA=false
PRODUCTION_BUILD=false
OPEN_BROWSER=true
SERVER_PID=""

cleanup() {
    if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
        echo ""
        echo "Stopping server (pid $SERVER_PID)..."
        kill "$SERVER_PID" 2>/dev/null || true
        wait "$SERVER_PID" 2>/dev/null || true
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

# --- dependency checks -------------------------------------------------------
#
# Node and pnpm are the only things this script cannot install for you: Node is
# a system package (use nvm/pacman), and pnpm ships with Node's corepack. The
# project's own dependencies are installed below without asking.

check_node() {
    command -v node >/dev/null 2>&1 || die "node is not installed (needs >= ${REQUIRED_NODE_MAJOR}). Try: pacman -S nodejs"

    local major
    major="$(node -p 'process.versions.node.split(".")[0]')"
    if (( major < REQUIRED_NODE_MAJOR )); then
        die "node ${major} is too old; this project needs >= ${REQUIRED_NODE_MAJOR} (it uses type stripping and Iterator Helpers)"
    fi
}

check_pnpm() {
    if command -v pnpm >/dev/null 2>&1; then
        return
    fi
    echo "pnpm not found; enabling it via corepack..."
    corepack enable pnpm 2>/dev/null || die "could not enable pnpm. Try: npm install -g pnpm"
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
    check_pnpm
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
