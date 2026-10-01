import type { Point } from "./types";

const EPSILON = 0.0001;

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function closestPointOnSegment(point: Point, start: Point, end: Point): { point: Point; t: number; distance: number } {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared < EPSILON ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  const projected = { x: start.x + t * dx, y: start.y + t * dy };
  return { point: projected, t, distance: distance(point, projected) };
}

export function closestSegment(point: Point, polyline: Point[]): { index: number; point: Point; distance: number } | null {
  if (polyline.length < 2) return null;
  let result: { index: number; point: Point; distance: number } | null = null;
  for (let index = 0; index < polyline.length - 1; index++) {
    const candidate = closestPointOnSegment(point, polyline[index], polyline[index + 1]);
    if (!result || candidate.distance < result.distance) result = { index, point: candidate.point, distance: candidate.distance };
  }
  return result;
}

export function pointAtPathFraction(points: Point[], fraction: number): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];
  const lengths = points.slice(0, -1).map((point, index) => distance(point, points[index + 1]));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (total < EPSILON) return points[0];
  let remaining = Math.max(0, Math.min(1, fraction)) * total;
  for (let index = 0; index < lengths.length; index++) {
    if (remaining <= lengths[index] || index === lengths.length - 1) {
      const ratio = lengths[index] < EPSILON ? 0 : remaining / lengths[index];
      return {
        x: points[index].x + (points[index + 1].x - points[index].x) * ratio,
        y: points[index].y + (points[index + 1].y - points[index].y) * ratio
      };
    }
    remaining -= lengths[index];
  }
  return points[points.length - 1];
}

export function polylinePath(points: Point[]): string {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${round(point.x)} ${round(point.y)}`).join(" ");
}

export function roundedPolylinePath(points: Point[], radius = 12): string {
  if (points.length < 3 || radius <= 0) return polylinePath(points);
  let path = `M ${round(points[0].x)} ${round(points[0].y)}`;
  for (let index = 1; index < points.length - 1; index++) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const incoming = distance(previous, current);
    const outgoing = distance(current, next);
    const actualRadius = Math.min(radius, incoming / 2, outgoing / 2);
    const before = moveToward(current, previous, actualRadius);
    const after = moveToward(current, next, actualRadius);
    path += ` L ${round(before.x)} ${round(before.y)} Q ${round(current.x)} ${round(current.y)} ${round(after.x)} ${round(after.y)}`;
  }
  const last = points[points.length - 1];
  return `${path} L ${round(last.x)} ${round(last.y)}`;
}

function moveToward(from: Point, to: Point, amount: number): Point {
  const length = distance(from, to);
  if (length < EPSILON) return from;
  return { x: from.x + ((to.x - from.x) / length) * amount, y: from.y + ((to.y - from.y) / length) * amount };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
