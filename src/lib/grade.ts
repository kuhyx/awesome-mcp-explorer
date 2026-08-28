/**
 * Glama grade vocabulary and ordering.
 *
 * The scale was derived empirically from the live badge endpoint: 627 glyph
 * definitions across a 110-badge sample yielded only A, B, C, D and F, and
 * **no `+` or `-` modifier exists**. The dash glyph that appears on some badges
 * is not a modifier — it is a grey placeholder meaning "this axis was never
 * graded" (see decode-badge.ts), verified against the rendered pages for
 * Muvon/octocode and sooperset/mcp-atlassian, both of which show a dash in the
 * quality slot and no quality grade at all in their HTML.
 *
 * That absence of modifiers is what makes {@link isTripleA} safe to define as a
 * literal `=== "A"` check: there is no higher or intermediate grade for it to
 * silently exclude.
 *
 * `E` and any modifier are *presumed* absent rather than proven impossible, so
 * the badge decoder treats an unrecognised glyph as a hard error rather than
 * defaulting it into this scale.
 */

/**
 * Best to worst. Index doubles as the rank, so order here is load-bearing.
 */
export const GRADES = ["A", "B", "C", "D", "F"] as const;

export type Grade = (typeof GRADES)[number];

/**
 * The three independently-graded axes, in the order the badge encodes them.
 */
export const GRADE_AXES = ["license", "quality", "maintenance"] as const;

export type GradeAxis = (typeof GRADE_AXES)[number];

/**
 * A server's grades. An axis is absent when Glama did not grade it.
 */
export type Grades = Partial<Record<GradeAxis, Grade>>;

/**
 * Rank of a grade: 0 is best (A), higher is worse.
 *
 * Used for both sorting and the "at least this good" per-axis filters.
 */
export function gradeRank(grade: Grade): number {
  return GRADES.indexOf(grade);
}

/**
 * True when `grade` is at least as good as `min`.
 */
export function isAtLeast(grade: Grade, min: Grade): boolean {
  return gradeRank(grade) <= gradeRank(min);
}

/**
 * The headline filter: all three axes graded, and all three `A`.
 *
 * There is no looser "A band" variant because the scale has no `A-`: with
 * modifiers absent, "A or A-" would be the same set as this, so a second
 * control would be a button that does nothing different. Callers wanting a
 * softer bar should use {@link isAtLeast} per axis instead.
 */
export function isTripleA(grades: Grades): boolean {
  return GRADE_AXES.every((axis) => grades[axis] === "A");
}

/**
 * How completely Glama graded a server.
 */
export type GradeCoverage = "graded-all" | "graded-partial" | "not-indexed";

export function gradeCoverage(grades: Grades | null): GradeCoverage {
  if (grades === null) return "not-indexed";
  const present = GRADE_AXES.filter((axis) => grades[axis] !== undefined);
  if (present.length === 0) return "not-indexed";
  return present.length === GRADE_AXES.length ? "graded-all" : "graded-partial";
}

/**
 * Sort key for a server's overall grade: the mean rank across graded axes.
 *
 * Ungraded servers return `null` rather than a sentinel number, so callers must
 * decide where they belong explicitly. Sorting them as "worst" would be a lie —
 * an ungraded server is unknown, not bad.
 */
export function compositeRank(grades: Grades | null): null | number {
  if (grades === null) return null;
  const ranks = GRADE_AXES.flatMap((axis) => {
    const grade = grades[axis];
    return grade === undefined ? [] : [gradeRank(grade)];
  });
  if (ranks.length === 0) return null;
  return ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length;
}
