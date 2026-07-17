import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RangeSlider } from "./range-slider.tsx";

/** A long-tailed distribution shaped like the real star counts. */
const VALUES = [0, 1, 2, 5, 8, 20, 44, 500, 5909, 166_785];

function renderSlider(over: Partial<Parameters<typeof RangeSlider>[0]> = {}) {
  const onChange = vi.fn();
  render(
    <RangeSlider
      format={(v): string => String(v)}
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
    const hiLeft = Number.parseFloat(
      (thumbs[1] as HTMLElement).style.left.replace("%", ""),
    );
    expect(hiLeft).toBeGreaterThan(40);
    expect(hiLeft).toBeLessThan(50);
  });

  it("does not move on a pointer move with no drag in progress", () => {
    const { onChange } = renderSlider();
    const track = document.querySelector(".slider-track");
    track?.dispatchEvent(
      new PointerEvent("pointermove", { bubbles: true, clientX: 600 }),
    );
    expect(onChange).not.toHaveBeenCalled();
  });
});
