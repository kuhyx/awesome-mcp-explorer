/**
 * A two-thumb slider whose track maps through a value *distribution*.
 *
 * Ported from `~/dufs-cloud/web/src/components/range-slider.tsx`. It exists
 * because a linear min..max track is useless on skewed data, and this dataset
 * is the most skewed case yet: stars run 0..166,785 with a median of 8, so the
 * midpoint of a linear track sits above 99.9% of all servers. Mapping through
 * the quantiles puts the middle of the track at the median.
 *
 * The component deals only in raw values; callers translate the extremes into
 * "no filter" (see the `onChange` contract below).
 */
import { useCallback, useRef } from "react";

import {
  fractionFromPointer,
  nth,
  quantileValue,
  valueQuantile,
} from "../lib/quantile.ts";

export interface RangeSliderProps {
  /** Formats a value for display, e.g. star counts or dates. */
  readonly format: (value: number) => string;
  readonly label: string;
  /** Current upper bound; equal to the max when unconstrained. */
  readonly max: number;
  /** Current lower bound; equal to the min when unconstrained. */
  readonly min: number;
  /**
   * Called with raw values. The caller decides that lo === values[0] means
   * "no lower bound", keeping the slider ignorant of filter semantics.
   */
  readonly onChange: (lo: number, hi: number) => void;
  /** The full ascending distribution — not just its endpoints. */
  readonly values: readonly number[];
}

export function RangeSlider({
  format,
  label,
  max,
  min,
  onChange,
  values,
}: RangeSliderProps): null | React.JSX.Element {
  const trackReference = useRef<HTMLDivElement>(null);
  const dragging = useRef<"hi" | "lo" | null>(null);

  // One callback per thumb rather than a curried factory: the factory was
  // created during render and closed over the ref, which the React Compiler
  // (rightly) reads as touching a ref during render.
  const startDrag = useCallback((thumb: "hi" | "lo", event: React.PointerEvent): void => {
    dragging.current = thumb;
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const handleMove = useCallback(
    (clientX: number): void => {
      const track = trackReference.current;
      if (track === null || dragging.current === null) return;
      const fraction = fractionFromPointer(track.getBoundingClientRect(), clientX);
      const value = quantileValue(values, fraction);
      if (dragging.current === "lo") onChange(Math.min(value, max), max);
      else onChange(min, Math.max(value, min));
    },
    [max, min, onChange, values],
  );

  // Fewer than two distinct values means there is nothing to range over.
  if (values.length < 2) return null;

  // Safe indexing, not `?? 0`: the guard above guarantees two or more values,
  // so a default would be an untestable branch that hides a real bug if the
  // guard ever changes.
  const lowest = nth(values, 0);
  const highest = nth(values, values.length - 1);
  const loFraction = valueQuantile(values, min);
  const hiFraction = valueQuantile(values, max);



  return (
    <div className="facet">
      <div className="slider-head">
        <span>{label}</span>
        <span className="slider-value">
          {format(min)} – {format(max)}
        </span>
      </div>
      <div
        className="slider-track"
        onPointerMove={(event): void => {
          handleMove(event.clientX);
        }}
        onPointerUp={(): void => {
          dragging.current = null;
        }}
        ref={trackReference}
      >
        <div
          className="slider-fill"
          style={{
            left: `${loFraction * 100}%`,
            width: `${(hiFraction - loFraction) * 100}%`,
          }}
        />
        <button
          aria-label={`${label} minimum: ${format(min)}`}
          aria-valuemax={highest}
          aria-valuemin={lowest}
          aria-valuenow={min}
          className="slider-thumb"
          onPointerDown={(event): void => {
            startDrag("lo", event);
          }}
          role="slider"
          style={{ left: `${loFraction * 100}%` }}
          tabIndex={0}
          type="button"
        />
        <button
          aria-label={`${label} maximum: ${format(max)}`}
          aria-valuemax={highest}
          aria-valuemin={lowest}
          aria-valuenow={max}
          className="slider-thumb"
          onPointerDown={(event): void => {
            startDrag("hi", event);
          }}
          role="slider"
          style={{ left: `${hiFraction * 100}%` }}
          tabIndex={0}
          type="button"
        />
      </div>
    </div>
  );
}
