import { describe, expect, it } from "vitest";
import { closestPointOnSegment, closestSegment, pointAtPathFraction, roundedPolylinePath } from "../src/geometry";

describe("geometry", () => {
  it("projects a point onto a segment", () => {
    expect(closestPointOnSegment({ x: 5, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({
      point: { x: 5, y: 0 }, t: 0.5, distance: 4
    });
  });

  it("finds the nearest polyline segment", () => {
    const result = closestSegment({ x: 9, y: 8 }, [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    expect(result?.index).toBe(1);
    expect(result?.point).toEqual({ x: 10, y: 8 });
  });

  it("interpolates by total path length", () => {
    expect(pointAtPathFraction([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 30 }], 0.5)).toEqual({ x: 10, y: 10 });
  });

  it("builds a rounded SVG polyline", () => {
    expect(roundedPolylinePath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], 2))
      .toBe("M 0 0 L 8 0 Q 10 0 10 2 L 10 10");
  });

  it("preserves multiple bend points in order", () => {
    expect(roundedPolylinePath([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 10 }
    ], 0)).toBe("M 0 0 L 10 0 L 10 10 L 20 10");
  });
});
