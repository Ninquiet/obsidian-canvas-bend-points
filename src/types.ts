import type { CanvasEdgeData } from "obsidian/canvas";

export interface Point {
  x: number;
  y: number;
}

export interface BendPoint extends Point {
  id: string;
}

export interface LabelPosition {
  /** Fraction of total path length, from 0 to 1. */
  t: number;
  /** Offset in canvas coordinates from the point at t. */
  dx: number;
  dy: number;
}

export interface BendEdgeData extends CanvasEdgeData {
  canvasBendPoints?: BendPoint[];
  canvasBendLabel?: LabelPosition;
}

export interface CanvasNodeLike {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  getData?: () => { id: string; x: number; y: number; width: number; height: number };
  getBBox?: () => { minX: number; minY: number; maxX: number; maxY: number };
}

export interface CanvasEdgeLike {
  id?: string;
  canvas: CanvasLike;
  from: { node: CanvasNodeLike; side?: string };
  to: { node: CanvasNodeLike; side?: string };
  path?: {
    display?: SVGPathElement | { el?: SVGPathElement; setAttr?: (name: string, value: string) => void };
    interaction?: SVGPathElement | { el?: SVGPathElement; setAttr?: (name: string, value: string) => void };
  };
  labelElement?: { el?: HTMLElement | SVGElement; render?: () => void } | HTMLElement | SVGElement;
  getData: () => BendEdgeData;
  setData?: (data: BendEdgeData) => void;
  render?: () => void;
  updatePath?: () => void;
  center?: Point;
  bezier?: { from: Point; to: Point };
}

export interface CanvasLike {
  edges: Map<string, CanvasEdgeLike>;
  nodes: Map<string, CanvasNodeLike>;
  selection?: Set<unknown>;
  wrapperEl?: HTMLElement;
  canvasEl?: HTMLElement;
  readonly?: boolean;
  tx?: number;
  ty?: number;
  zoom?: number;
  markDirty?: (item: unknown) => void;
  requestSave?: () => void;
  selectOnly?: (item: unknown) => void;
  getData?: () => { edges: BendEdgeData[] };
}

export interface CanvasViewLike {
  canvas?: CanvasLike;
  file?: { extension?: string };
  getViewType?: () => string;
}
