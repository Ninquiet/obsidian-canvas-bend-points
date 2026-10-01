import { Notice, Platform } from "obsidian";
import { closestSegment, pointAtPathFraction, roundedPolylinePath } from "./geometry";
import type { BendEdgeData, BendPoint, CanvasEdgeLike, CanvasLike, Point } from "./types";

export interface ControllerSettings {
  bendRadius: number;
  showHandles: "selected" | "always";
  handleSize: number;
}

interface ListenerRecord {
  element: Element;
  type: string;
  listener: EventListener;
  capture: boolean;
}

export class CanvasController {
  private animationFrame = 0;
  private destroyed = false;
  private readonly listeners: ListenerRecord[] = [];
  private readonly boundPaths = new WeakSet<Element>();
  private readonly boundLabels = new WeakSet<Element>();
  private readonly handleGroups = new Map<string, HTMLDivElement>();
  private readonly draftData = new WeakMap<CanvasEdgeLike, BendEdgeData>();

  constructor(private readonly canvas: CanvasLike, private readonly settings: ControllerSettings) {
    this.loop = this.loop.bind(this);
    this.animationFrame = window.requestAnimationFrame(this.loop);
  }

  destroy(): void {
    this.destroyed = true;
    window.cancelAnimationFrame(this.animationFrame);
    for (const { element, type, listener, capture } of this.listeners) element.removeEventListener(type, listener, capture);
    for (const group of this.handleGroups.values()) group.remove();
    this.handleGroups.clear();
    this.canvas.wrapperEl?.removeClass("canvas-bend-points-active");
  }

  refreshSettings(settings: ControllerSettings): void {
    this.settings.bendRadius = settings.bendRadius;
    this.settings.showHandles = settings.showHandles;
    this.settings.handleSize = settings.handleSize;
  }

  resetSelectedEdges(): number {
    const selected = this.canvas.selection ?? new Set();
    let changed = 0;
    for (const edge of this.canvas.edges.values()) {
      if (!selected.has(edge)) continue;
      const data = this.draftData.get(edge) ?? edge.getData();
      if (!data.canvasBendPoints?.length && !data.canvasBendLabel) continue;
      delete data.canvasBendPoints;
      delete data.canvasBendLabel;
      this.persist(edge, data);
      changed++;
    }
    return changed;
  }

  private loop(): void {
    if (this.destroyed) return;
    this.canvas.wrapperEl?.addClass("canvas-bend-points-active");
    this.scanEdges();
    this.animationFrame = window.requestAnimationFrame(this.loop);
  }

  private scanEdges(): void {
    const existing = new Set<string>();
    for (const [mapId, edge] of this.canvas.edges.entries()) {
      const id = edge.getData().id || edge.id || mapId;
      existing.add(id);
      const display = resolveSvgElement(edge.path?.display);
      const interaction = resolveSvgElement(edge.path?.interaction);
      if (interaction && !this.boundPaths.has(interaction)) this.bindPath(interaction, edge);
      if (display && !this.boundPaths.has(display)) this.bindPath(display, edge);
      const data = edge.getData();
      const points = this.edgePoints(edge, data);
      if (data.canvasBendPoints?.length) {
        const path = roundedPolylinePath(points, this.settings.bendRadius);
        setPath(display, path);
        setPath(interaction, path);
        edge.center = pointAtPathFraction(points, 0.5);
      }
      this.renderHandles(edge, id, data, points, display ?? interaction);
      this.bindAndPositionLabel(edge, data, points);
    }
    for (const [id, group] of this.handleGroups.entries()) {
      if (!existing.has(id)) {
        group.remove();
        this.handleGroups.delete(id);
      }
    }
  }

  private bindPath(path: SVGPathElement, edge: CanvasEdgeLike): void {
    this.boundPaths.add(path);
    const onPointerDown = ((event: PointerEvent) => {
      const liveEdge = this.getLiveEdge(edge);
      if (this.canvas.readonly || !liveEdge.getData().canvasBendPoints?.length) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.canvas.selectOnly?.(liveEdge);
    }) as EventListener;
    const onDoubleClick = ((event: MouseEvent) => {
      if (this.canvas.readonly || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const canvasPoint = screenToSvg(path, { x: event.clientX, y: event.clientY });
      const liveEdge = this.getLiveEdge(edge);
      const data = liveEdge.getData();
      const polyline = this.edgePoints(liveEdge, data);
      const nearest = closestSegment(canvasPoint, polyline);
      if (!nearest) return;
      const bendPoint: BendPoint = { id: createId(), x: canvasPoint.x, y: canvasPoint.y };
      const bends = [...(data.canvasBendPoints ?? [])];
      bends.splice(nearest.index, 0, bendPoint);
      data.canvasBendPoints = bends;
      this.persist(liveEdge, data);
    }) as EventListener;
    this.listen(path, "pointerdown", onPointerDown, true);
    this.listen(path, "dblclick", onDoubleClick);
  }

  private renderHandles(edge: CanvasEdgeLike, edgeId: string, data: BendEdgeData, points: Point[], referencePath: SVGPathElement | null): void {
    const bends = data.canvasBendPoints ?? [];
    const selected = this.canvas.selection?.has(edge) ?? false;
    const visible = bends.length > 0 && (this.settings.showHandles === "always" || selected);
    let group = this.handleGroups.get(edgeId);
    if (!visible || !referencePath) {
      group?.remove();
      this.handleGroups.delete(edgeId);
      return;
    }
    const wrapper = this.canvas.wrapperEl;
    if (!wrapper) return;
    if (!group || group.parentElement !== wrapper) {
      group?.remove();
      group = document.createElement("div");
      group.addClass("canvas-bend-point-layer");
      wrapper.appendChild(group);
      this.handleGroups.set(edgeId, group);
    }
    while (group.childElementCount > bends.length) group.lastElementChild?.remove();
    const wrapperRect = wrapper.getBoundingClientRect();
    bends.forEach((bend, index) => {
      let handle = group.children[index] as HTMLButtonElement | undefined;
      if (!handle) {
        handle = document.createElement("button");
        handle.type = "button";
        handle.addClass("canvas-bend-point");
        group.appendChild(handle);
        this.bindHandle(handle, edge, referencePath);
      }
      const screenPoint = svgToScreen(referencePath, bend);
      handle.dataset.pointId = bend.id;
      handle.style.left = `${screenPoint.x - wrapperRect.left}px`;
      handle.style.top = `${screenPoint.y - wrapperRect.top}px`;
      handle.style.width = `${this.settings.handleSize * 2}px`;
      handle.style.height = `${this.settings.handleSize * 2}px`;
      handle.setAttribute("aria-label", "Arrastrar punto; doble clic para eliminar");
    });
    void points;
  }

  private bindHandle(handle: HTMLButtonElement, edge: CanvasEdgeLike, referencePath: SVGPathElement): void {
    const onPointerDown = ((event: PointerEvent) => {
      if (this.canvas.readonly || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      handle.setPointerCapture(event.pointerId);
      handle.addClass("is-dragging");
      const pointId = handle.dataset.pointId;
      if (!pointId) return;
      const liveEdge = this.getLiveEdge(edge);
      const dragData = cloneEdgeData(liveEdge.getData());
      this.draftData.set(liveEdge, dragData);
      const previewPath = this.createDragPreview(liveEdge);
      const onMove = (moveEvent: PointerEvent): void => {
        moveEvent.preventDefault();
        moveEvent.stopPropagation();
        moveEvent.stopImmediatePropagation();
        const currentEdge = this.getLiveEdge(liveEdge);
        const currentPath = resolveSvgElement(currentEdge.path?.display) ?? resolveSvgElement(currentEdge.path?.interaction) ?? referencePath;
        const point = screenToSvg(currentPath, { x: moveEvent.clientX, y: moveEvent.clientY });
        const bend = dragData.canvasBendPoints?.find((candidate) => candidate.id === pointId);
        if (!bend) return;
        bend.x = point.x;
        bend.y = point.y;
        this.renderEdgePreview(currentEdge, dragData, previewPath);
      };
      const onUp = (upEvent: PointerEvent): void => {
        upEvent.preventDefault();
        upEvent.stopPropagation();
        upEvent.stopImmediatePropagation();
        handle.releasePointerCapture(upEvent.pointerId);
        handle.removeClass("is-dragging");
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onUp);
        previewPath?.remove();
        const currentEdge = this.getLiveEdge(liveEdge);
        this.persist(currentEdge, dragData);
        this.draftData.delete(liveEdge);
        this.draftData.delete(currentEdge);
      };
      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onUp);
    }) as EventListener;
    const onDoubleClick = ((event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const pointId = handle.dataset.pointId;
      const liveEdge = this.getLiveEdge(edge);
      const data = liveEdge.getData();
      data.canvasBendPoints = (data.canvasBendPoints ?? []).filter((point) => point.id !== pointId);
      if (data.canvasBendPoints.length === 0) delete data.canvasBendPoints;
      this.persist(liveEdge, data);
    }) as EventListener;
    this.listen(handle, "pointerdown", onPointerDown);
    this.listen(handle, "dblclick", onDoubleClick);
  }

  private bindAndPositionLabel(edge: CanvasEdgeLike, data: BendEdgeData, points: Point[]): void {
    const label = resolveElement(edge.labelElement);
    if (!label) return;
    if (!this.boundLabels.has(label)) {
      this.boundLabels.add(label);
      label.addClass("canvas-bend-label");
      const onPointerDown = ((event: PointerEvent) => {
        if (this.canvas.readonly || event.button !== 0 || !(event.altKey || Platform.isMobile)) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        const reference = resolveSvgElement(edge.path?.display) ?? label;
        const start = screenToSvg(reference, { x: event.clientX, y: event.clientY });
        const dragData = cloneEdgeData(edge.getData());
        const initial = dragData.canvasBendLabel ?? { t: 0.5, dx: 0, dy: 0 };
        this.draftData.set(edge, dragData);
        label.setPointerCapture(event.pointerId);
        const onMove = (moveEvent: PointerEvent): void => {
          moveEvent.preventDefault();
          moveEvent.stopPropagation();
          moveEvent.stopImmediatePropagation();
          const current = screenToSvg(reference, { x: moveEvent.clientX, y: moveEvent.clientY });
          dragData.canvasBendLabel = { t: initial.t, dx: initial.dx + current.x - start.x, dy: initial.dy + current.y - start.y };
        };
        const onUp = (upEvent: PointerEvent): void => {
          upEvent.preventDefault();
          upEvent.stopPropagation();
          upEvent.stopImmediatePropagation();
          label.releasePointerCapture(upEvent.pointerId);
          label.removeEventListener("pointermove", onMove);
          label.removeEventListener("pointerup", onUp);
          label.removeEventListener("pointercancel", onUp);
          this.persist(edge, dragData);
          this.draftData.delete(edge);
        };
        label.addEventListener("pointermove", onMove);
        label.addEventListener("pointerup", onUp);
        label.addEventListener("pointercancel", onUp);
      }) as EventListener;
      const onDoubleClick = ((event: MouseEvent) => {
        if (!event.altKey) return;
        event.preventDefault();
        event.stopPropagation();
        const currentData = edge.getData();
        delete currentData.canvasBendLabel;
        this.persist(edge, currentData);
      }) as EventListener;
      this.listen(label, "pointerdown", onPointerDown);
      this.listen(label, "dblclick", onDoubleClick);
    }
    const position = data.canvasBendLabel;
    label.toggleClass("is-canvas-bend-label-moved", Boolean(position));
    (label as HTMLElement).style.translate = position ? `${position.dx}px ${position.dy}px` : "";
    if (position) edge.center = pointAtPathFraction(points, position.t);
  }

  private edgePoints(edge: CanvasEdgeLike, data: BendEdgeData): Point[] {
    const from = edge.bezier?.from ?? endpoint(edge.from.node, data.fromSide ?? edge.from.side, "right");
    const to = edge.bezier?.to ?? endpoint(edge.to.node, data.toSide ?? edge.to.side, "left");
    return [from, ...(data.canvasBendPoints ?? []), to];
  }

  private persist(edge: CanvasEdgeLike, data: BendEdgeData): void {
    edge.setData?.(data);
    this.canvas.markDirty?.(edge);
    this.canvas.requestSave?.();
  }

  private createDragPreview(edge: CanvasEdgeLike): SVGPathElement | null {
    const display = resolveSvgElement(edge.path?.display);
    const source = display ?? resolveSvgElement(edge.path?.interaction);
    if (!source?.ownerSVGElement) return null;
    const preview = source.cloneNode(false) as SVGPathElement;
    preview.removeAttribute("id");
    preview.addClass("canvas-bend-preview-path");
    preview.setAttribute("pointer-events", "none");
    source.ownerSVGElement.appendChild(preview);
    return preview;
  }

  private renderEdgePreview(edge: CanvasEdgeLike, data: BendEdgeData, preview: SVGPathElement | null): void {
    const pathValue = roundedPolylinePath(this.edgePoints(edge, data), this.settings.bendRadius);
    setPath(preview, pathValue);
    setPath(resolveSvgElement(edge.path?.display), pathValue);
    setPath(resolveSvgElement(edge.path?.interaction), pathValue);
  }

  private getLiveEdge(edge: CanvasEdgeLike): CanvasEdgeLike {
    const edgeId = edge.getData().id || edge.id;
    if (!edgeId) return edge;
    return this.canvas.edges.get(edgeId) ?? [...this.canvas.edges.values()].find((candidate) => candidate.getData().id === edgeId) ?? edge;
  }

  private listen(element: Element, type: string, listener: EventListener, capture = false): void {
    element.addEventListener(type, listener, capture);
    this.listeners.push({ element, type, listener, capture });
  }
}

function endpoint(node: { x: number; y: number; width: number; height: number; getData?: () => { x: number; y: number; width: number; height: number } }, side: string | undefined, fallback: string): Point {
  const box = node.getData?.() ?? node;
  switch (side ?? fallback) {
    case "top": return { x: box.x + box.width / 2, y: box.y };
    case "bottom": return { x: box.x + box.width / 2, y: box.y + box.height };
    case "left": return { x: box.x, y: box.y + box.height / 2 };
    default: return { x: box.x + box.width, y: box.y + box.height / 2 };
  }
}

function resolveSvgElement(value: CanvasEdgeLike["path"] extends infer _T ? unknown : never): SVGPathElement | null {
  if (value instanceof SVGPathElement) return value;
  if (value && typeof value === "object" && "el" in value && (value as { el?: unknown }).el instanceof SVGPathElement) return (value as { el: SVGPathElement }).el;
  return null;
}

function resolveElement(value: CanvasEdgeLike["labelElement"]): HTMLElement | SVGElement | null {
  if (value instanceof HTMLElement || value instanceof SVGElement) return value;
  if (value && typeof value === "object" && "el" in value) {
    const el = value.el;
    if (el instanceof HTMLElement || el instanceof SVGElement) return el;
  }
  return null;
}

function setPath(path: SVGPathElement | null, value: string): void {
  path?.setAttribute("d", value);
}

function screenToSvg(reference: Element, point: Point): Point {
  const svgElement = reference instanceof SVGGraphicsElement ? reference : reference.closest("svg")?.querySelector("path");
  const matrix = svgElement instanceof SVGGraphicsElement ? svgElement.getScreenCTM()?.inverse() : null;
  if (!matrix) return point;
  const transformed = new DOMPoint(point.x, point.y).matrixTransform(matrix);
  return { x: transformed.x, y: transformed.y };
}

function svgToScreen(reference: SVGGraphicsElement, point: Point): Point {
  const matrix = reference.getScreenCTM();
  if (!matrix) return point;
  const transformed = new DOMPoint(point.x, point.y).matrixTransform(matrix);
  return { x: transformed.x, y: transformed.y };
}

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function cloneEdgeData(data: BendEdgeData): BendEdgeData {
  return {
    ...data,
    canvasBendPoints: data.canvasBendPoints?.map((point) => ({ ...point })),
    canvasBendLabel: data.canvasBendLabel ? { ...data.canvasBendLabel } : undefined
  };
}

export function showResetNotice(count: number): void {
  new Notice(count === 0 ? "Selecciona una conexión con puntos o label movido." : `Se restablecieron ${count} conexión${count === 1 ? "" : "es"}.`);
}
