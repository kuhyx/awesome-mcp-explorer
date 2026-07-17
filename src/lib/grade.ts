/**
 * Glama grade vocabulary and ordering.
 *
 * The scale was derived empirically from 627 glyph definitions across a
 * 110-badge sample of the live Glama badge endpoint: only A, A-, B, B-, C, D
 * and F were ever observed. In particular **no `+` glyph exists anywhere**,
 * which is what makes `isTripleA` safe to define as a literal `=== "A"` check:
 * there is no higher grade for it to silently exclude.
 *
 * `E` and the `+` variants are *presumed* absent rather than proven impossible,
 * so the badge decoder treats an unrecognised glyph as a hard error instead of
 * defaulting it into this scale.
 */

/** Best to worst. Index doubles as the rank, so order here is load-bearing. */
export const GRADES = ["A", "A-", "B", "B-", "C", "C-", "D", "F"] as const;

export type Grade = (typeof GRADES)[number];

/** The three independently-graded axes, in the order the badge encodes them. */
export const GRADE_AXES = ["license", "quality", "maintenance"] as const;

export type GradeAxis = (typeof GRADE_AXES)[number];

/** A server's grades. An axis is absent when Glama did not grade it. */
export type Grades = Partial<Record<GradeAxis, Grade>>;

/**
 * Rank of a grade: 0 is best (A), higher is worse.
 *
 * Used for both sorting and the "at least this good" per-axis filters.
 */
export function gradeRank(grade: Grade): number {
  return GRADES.indexOf(grade);
}

/** True when `grade` is at least as good as `min`. */
export function isAtLeast(grade: Grade, min: Grade): boolean {
  return gradeRank(grade) <= gradeRank(min);
}

/**
 * The headline filter: all three axes graded, and all three exactly `A`.
 *
 * Deliberately strict — a server with `A-` on any axis is not triple-A. Use
 * {@link isABand} for the looser reading.
 */
export function isTripleA(grades: Grades): boolean {
  return GRADE_AXES.every((axis) => grades[axis] === "A");
}

/** Looser triple-A: all three axes graded and all within the A band (A or A-). */
export function isABand(grades: Grades): boolean {
  return GRADE_AXES.every((axis) => {
    const grade = grades[axis];
    return grade !== undefined && isAtLeast(grade, "A-");
  });
}

/** How completely Glama graded a server. */
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
