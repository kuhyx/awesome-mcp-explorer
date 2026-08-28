/**
 * One server in the list.
 *
 * The load-bearing detail here is provenance. Cost and rate-limiting are
 * *inferred* from the README's scope markers and description text — neither the
 * awesome list nor Glama publishes them — so those chips render with a dashed
 * border and a `~` prefix, and say so on hover. A chip sourced from
 * `data/overrides.json` is a checked fact and renders solid. An inferred value
 * must never be mistaken for a fact.
 */
import type { InferredFact, Server } from "../lib/server.ts";

import { GRADE_AXES } from "../lib/grade.ts";

const COST_LABELS = {
  "likely-free": "free",
  "likely-paid": "paid",
  unknown: "cost unknown",
} as const;

const RATE_LABELS = { no: "no rate limit", unknown: "limits unknown", yes: "rate limited" } as const;

/**
 * "59.3k" — keeps the star column narrow and non-jittery.
 */
export function formatStars(stars: number): string {
  if (stars < 1000) return String(stars);
  return `${(stars / 1000).toFixed(stars < 10_000 ? 1 : 0)}k`;
}

/**
 * "3 days ago", "2 years ago".
 */
export function formatAge(iso: string, now: number): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "unknown";
  const days = Math.floor((now - then) / 86_400_000);
  if (days < 1) return "today";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function InferredChip({
  fact,
  label,
}: {
  readonly fact: InferredFact<string>;
  readonly label: string;
}): React.JSX.Element {
  const isInferred = fact.source === "inferred";
  return (
    <span
      className={`chip ${isInferred ? "chip-inferred" : "chip-fact"}`}
      title={
        isInferred
          ? "Inferred from the server's scope and description — not published data. Correct it in data/overrides.json."
          : "Checked by hand and recorded in data/overrides.json."
      }
    >
      {isInferred ? "~" : ""}
      {label}
    </span>
  );
}

export interface ServerRowProps {
  /**
   * Injected so the row stays pure and its age text is testable.
   */
  readonly now: number;
  readonly server: Server;
}

export function ServerRow({ now, server }: ServerRowProps): React.JSX.Element {
  const { gh, glama } = server;

  return (
    <article className="row">
      <div className="row-main">
        <div className="row-head">
          <a className="row-name" href={server.url} rel="noreferrer" target="_blank">
            {server.id}
          </a>
          {server.official && (
            <span className="chip chip-official" title="Official implementation">
              🎖️ official
            </span>
          )}
          {gh?.archived === true && (
            <span className="chip chip-dead" title="Archived on GitHub">
              archived
            </span>
          )}
        </div>
        <p className="row-desc">{server.description}</p>
        <div className="row-chips">
          {server.languages.map((language) => {
            return (
              <span className="chip" key={language}>
                {language}
              </span>
            );
          })}
          {server.scope.map((scope) => {
            return (
              <span className="chip chip-scope" key={scope}>
                {scope}
              </span>
            );
          })}
          <InferredChip fact={server.cost} label={COST_LABELS[server.cost.value]} />
          <InferredChip
            fact={server.rateLimited}
            label={RATE_LABELS[server.rateLimited.value]}
          />
          {server.categories.map((category) => {
            return (
              <span className="chip chip-cat" key={category}>
                {category}
              </span>
            );
          })}
        </div>
      </div>

      <div className="row-meta">
        <div className="grades" title="Glama: licence / quality / maintenance">
          {glama === null ? (
            <span className="grade grade-none">not on Glama</span>
          ) : (
            GRADE_AXES.map((axis) => {
              const grade = glama[axis];
              return (
                <span
                  className={`grade grade-${grade ?? "ungraded"}`}
                  key={axis}
                  title={
                    grade === undefined
                      ? `${axis}: not graded`
                      : `${axis}: ${grade}`
                  }
                >
                  {grade ?? "–"}
                </span>
              );
            })
          )}
        </div>
        <div className="row-stats">
          <span title="GitHub stars">★ {gh === null ? "?" : formatStars(gh.stars)}</span>
          <span title="Last push">
            {gh === null ? "gone" : formatAge(gh.pushedAt, now)}
          </span>
          <span
            className={gh?.isFoss === "yes" ? "foss-yes" : "foss-no"}
            title={gh?.spdx ?? "No licence file: all rights reserved"}
          >
            {gh?.spdx ?? "no licence"}
          </span>
        </div>
      </div>
    </article>
  );
}
