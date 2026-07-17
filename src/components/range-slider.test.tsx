import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RangeSlider } from "./range-slider.tsx";

/** A long-tailed distribution shaped like the real star counts. */
const VALUES = [0, 1, 2, 5, 8, 20, 44, 500, 5909, 166_785];

function renderSlider(over: Partial<Parameters<typeof RangeSlider>[0]> = {}) {
  const onChange = vi.fn();
  render(
    <RangeSlider
      format={String}
      label="Stars"
      max={166_785}
      min={0}
      onChange={onChange}
      values={VALUES}
      {...over}
    />,
  );
  return { onChange };
}

describe("RangeSlider", () => {
  it("renders nothing when there is nothing to range over", () => {
    const { container } = render(
      <RangeSlider
        format={String}
        label="Stars"
        max={0}
        min={0}
        onChange={vi.fn()}
        values={[]}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for a single value", () => {
    const { container } = render(
      <RangeSlider
        format={String}
        label="Stars"
        max={5}
        min={5}
        onChange={vi.fn()}
        values={[5]}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the current range", () => {
    renderSlider();
    expect(screen.getByText("0 – 166785")).toBeInTheDocument();
  });

  it("exposes both thumbs as sliders with the real bounds", () => {
    renderSlider();
    const thumbs = screen.getAllByRole("slider");
    expect(thumbs).toHaveLength(2);
    expect(thumbs[0]).toHaveAttribute("aria-valuemin", "0");
    expect(thumbs[0]).toHaveAttribute("aria-valuemax", "166785");
  });

  it("labels each thumb with its formatted value", () => {
    renderSlider({ format: (v): string => `${v} stars` });
    expect(screen.getByLabelText("Stars minimum: 0 stars")).toBeInTheDocument();
    expect(screen.getByLabelText("Stars maximum: 166785 stars")).toBeInTheDocument();
  });

  it("places the thumbs by QUANTILE, not by linear value", () => {
    // The whole point. The median (8) sits at the middle of the track even
    // though it is 0.005% of the way along a linear 0..166,785 scale.
    renderSlider({ max: 8 });
    const thumbs = screen.getAllByRole("slider");
    const hiLeft = Number(
      (thumbs[1]!).style.left.replace("%", ""),
    );
    expect(hiLeft).toBeGreaterThan(40);
    expect(hiLeft).toBeLessThan(50);
  });

  it("does not move on a pointer move with no drag in progress", () => {
    const { onChange } = renderSlider();
    drag.move(600);
    expect(onChange).not.toHaveBeenCalled();
  });
});

/**
 * Pointer drags, driven through raw PointerEvents.
 *
 * userEvent has no drag primitive for a custom slider, and jsdom does not
 * implement pointer capture, so the events are dispatched directly. The track
 * geometry comes from the getBoundingClientRect stub in src/test/setup.ts:
 * 1200px wide starting at x=0.
 */
const drag = {
  down(thumb: "hi" | "lo"): void {
    const thumbs = screen.getAllByRole("slider");
    const target = thumbs[thumb === "lo" ? 0 : 1]!;
    target.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }),
    );
  },
  move(clientX: number): void {
    document
      .querySelector(".slider-track")
      ?.dispatchEvent(
        new PointerEvent("pointermove", { bubbles: true, clientX, pointerId: 1 }),
      );
  },
  up(): void {
    document
      .querySelector(".slider-track")
      ?.dispatchEvent(
        new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }),
      );
  },
};

describe("RangeSlider dragging", () => {
  it("moves the lower bound to the quantile under the pointer", () => {
    const { onChange } = renderSlider();
    drag.down("lo");
    // Halfway across a 1200px track. VALUES has 10 entries, so quantile 0.5
    // interpolates between the 5th and 6th (8 and 20) -> 14.
    drag.move(600);
    expect(onChange).toHaveBeenCalledWith(14, 166_785);
  });

  it("moves the upper bound", () => {
    const { onChange } = renderSlider();
    drag.down("hi");
    drag.move(600);
    expect(onChange).toHaveBeenCalledWith(0, 14);
  });

  it("stops moving once the pointer is released", () => {
    const { onChange } = renderSlider();
    drag.down("lo");
    drag.up();
    onChange.mockClear();
    drag.move(300);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not let the lower bound cross above the upper", () => {
    const { onChange } = renderSlider({ max: 5 });
    drag.down("lo");
    drag.move(1200); // drag the low thumb to the far right
    expect(onChange).toHaveBeenCalledWith(5, 5);
  });

  it("does not let the upper bound cross below the lower", () => {
    const { onChange } = renderSlider({ min: 500 });
    drag.down("hi");
    drag.move(0); // drag the high thumb to the far left
    expect(onChange).toHaveBeenCalledWith(500, 500);
  });

  it("clamps a pointer beyond the track", () => {
    const { onChange } = renderSlider();
    drag.down("lo");
    drag.move(99_999);
    expect(onChange).toHaveBeenCalledWith(166_785, 166_785);
  });
});
