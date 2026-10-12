import { adjustedBounds } from "@/lib/mapGeometry";
import type { AreaAdjustment, AreaBounds } from "@/lib/mapGeometry";

export type SnapHandle = "move" | "nw" | "ne" | "sw" | "se";
export type SnapShape = AreaBounds & { pieces?: AreaBounds[] };

/** shortcut: Curved or diagonal SVG paths use their bounding box; use path intersections if those shapes enter the editor. */
export const pathPieces = (path: string, adjustment: AreaAdjustment): AreaBounds[] | null => {
  const tokenPattern = /[MmLlHhVvZz]|[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?/g;
  if (path.replace(tokenPattern, "").replace(/[\s,]/g, "")) return null;
  const tokens = path.match(tokenPattern) ?? [];
  const points: { x: number; y: number }[] = [];
  let x = 0, y = 0, index = 0, command = "", closed = false;
  while (index < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[index])) command = tokens[index++];
    if (command.toUpperCase() === "Z") { closed = true; break; }
    if (!/^[MmLlHhVv]$/.test(command) || index >= tokens.length || /^[A-Za-z]$/.test(tokens[index])) return null;
    const relative = command === command.toLowerCase();
    const first = Number(tokens[index++]);
    if (command.toUpperCase() === "M" || command.toUpperCase() === "L") {
      if (index >= tokens.length || /^[A-Za-z]$/.test(tokens[index])) return null;
      const second = Number(tokens[index++]);
      x = relative ? x + first : first;
      y = relative ? y + second : second;
      if (command.toUpperCase() === "M") command = relative ? "l" : "L";
    } else if (command.toUpperCase() === "H") x = relative ? x + first : first;
    else y = relative ? y + first : first;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    points.push({ x, y });
    if (points.length > 64) return null;
  }
  if (!closed || index !== tokens.length || points.length < 4) return null;
  if (points[0].x === points.at(-1)?.x && points[0].y === points.at(-1)?.y) points.pop();
  if (points.some((point, i) => {
    const next = points[(i + 1) % points.length];
    return point.x !== next.x && point.y !== next.y;
  })) return null;
  const xs = [...new Set(points.map((point) => point.x))].sort((a, b) => a - b);
  const ys = [...new Set(points.map((point) => point.y))].sort((a, b) => a - b);
  if (xs.length * ys.length > 1024) return null;
  const inside = (px: number, py: number) => {
    let filled = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i], b = points[j];
      if ((a.y > py) !== (b.y > py) && px < (b.x - a.x) * (py - a.y) / (b.y - a.y) + a.x) filled = !filled;
    }
    return filled;
  };
  const pieces: AreaBounds[] = [];
  for (let yi = 0; yi < ys.length - 1; yi++) {
    let start: number | null = null;
    for (let xi = 0; xi < xs.length; xi++) {
      const occupied = xi < xs.length - 1 && inside((xs[xi] + xs[xi + 1]) / 2, (ys[yi] + ys[yi + 1]) / 2);
      if (occupied && start === null) start = xi;
      if (!occupied && start !== null) {
        pieces.push(adjustedBounds({ x: xs[start], y: ys[yi], width: xs[xi] - xs[start], height: ys[yi + 1] - ys[yi] }, adjustment));
        start = null;
      }
    }
  }
  return pieces.length ? pieces : null;
};

type SnapOptions = {
  tolerance: number;
  handle: SnapHandle;
  allowOverlap: boolean;
  previous?: SnapShape;
  blockers?: SnapShape[];
  minimum?: { width: number; height: number };
  maximum?: { width: number; height: number };
  canvas?: { width: number; height: number };
};

const right = (box: AreaBounds) => box.x + box.width;
const bottom = (box: AreaBounds) => box.y + box.height;
const intersects = (a: AreaBounds, b: AreaBounds) =>
  a.x < right(b) && right(a) > b.x && a.y < bottom(b) && bottom(a) > b.y;
const parts = (shape: SnapShape) => shape.pieces?.length ? shape.pieces : [shape];
const movedParts = (box: AreaBounds, previous?: SnapShape): AreaBounds[] => previous?.pieces?.length
  ? previous.pieces.map((piece) => ({
    x: box.x + (piece.x - previous.x) * box.width / previous.width,
    y: box.y + (piece.y - previous.y) * box.height / previous.height,
    width: piece.width * box.width / previous.width,
    height: piece.height * box.height / previous.height,
  })) : [box];
const shapesIntersect = (a: SnapShape, b: SnapShape) => parts(a).some((piece) => parts(b).some((other) => intersects(piece, other)));

const sweptIntersects = (start: AreaBounds, end: AreaBounds, peer: AreaBounds) => {
  const lessThan = (from: number, to: number, bound: number) => {
    if (to === from) return from < bound ? [-Infinity, Infinity] : [Infinity, -Infinity];
    const crossing = (bound - from) / (to - from);
    return to > from ? [-Infinity, crossing] : [crossing, Infinity];
  };
  const ranges = [
    lessThan(start.x, end.x, right(peer)),
    lessThan(-right(start), -right(end), -peer.x),
    lessThan(start.y, end.y, bottom(peer)),
    lessThan(-bottom(start), -bottom(end), -peer.y),
  ];
  return Math.max(0, ...ranges.map(([enter]) => enter)) < Math.min(1, ...ranges.map(([, exit]) => exit));
};

const adjustEdge = (box: AreaBounds, axis: "x" | "y", side: "start" | "end", delta: number, handle: SnapHandle): AreaBounds => {
  if (axis === "x") {
    if (handle === "move") return { ...box, x: box.x + delta };
    return side === "start" ? { ...box, x: box.x + delta, width: box.width - delta }
      : { ...box, width: box.width + delta };
  }
  if (handle === "move") return { ...box, y: box.y + delta };
  return side === "start" ? { ...box, y: box.y + delta, height: box.height - delta }
    : { ...box, height: box.height + delta };
};

const movableSides = (axis: "x" | "y", handle: SnapHandle): ("start" | "end")[] => {
  if (handle === "move") return ["start", "end"];
  return axis === "x" ? [handle.includes("w") ? "start" : "end"]
    : [handle.includes("n") ? "start" : "end"];
};

const edgeDelta = (piece: AreaBounds, original: AreaBounds, axis: "x" | "y", side: "start" | "end",
  target: number, options: SnapOptions) => {
  const edge = axis === "x" ? side === "start" ? piece.x : right(piece)
    : side === "start" ? piece.y : bottom(piece);
  if (options.handle === "move" || !options.previous) return target - edge;
  const base = axis === "x" ? options.previous.x : options.previous.y;
  const size = axis === "x" ? options.previous.width : options.previous.height;
  const originalEdge = axis === "x" ? side === "start" ? original.x : right(original)
    : side === "start" ? original.y : bottom(original);
  const fraction = (originalEdge - base) / size;
  const movingStart = axis === "x" ? options.handle.includes("w") : options.handle.includes("n");
  const leverage = movingStart ? 1 - fraction : fraction;
  return leverage > 0 ? (target - edge) / leverage : NaN;
};

const valid = (box: AreaBounds, { minimum, maximum, canvas }: SnapOptions) =>
  box.width >= (minimum?.width ?? 0.001) && box.height >= (minimum?.height ?? 0.001) &&
  (!maximum || (box.width <= maximum.width && box.height <= maximum.height)) &&
  (!canvas || (box.x >= 0 && box.y >= 0 && right(box) <= canvas.width && bottom(box) <= canvas.height));

const snapAxis = (box: AreaBounds, peers: SnapShape[], axis: "x" | "y", options: SnapOptions): AreaBounds => {
  const { tolerance, handle } = options;
  let best = box;
  let distance = tolerance + 1;
  for (const peer of peers) for (const targetPiece of parts(peer)) {
    for (const [index, movingPiece] of movedParts(box, options.previous).entries()) {
      const perpendicularOverlap = axis === "x"
        ? Math.min(bottom(movingPiece), bottom(targetPiece)) - Math.max(movingPiece.y, targetPiece.y)
        : Math.min(right(movingPiece), right(targetPiece)) - Math.max(movingPiece.x, targetPiece.x);
      if (perpendicularOverlap <= 0) continue;
      for (const side of movableSides(axis, handle)) {
        const edge = axis === "x" ? side === "start" ? movingPiece.x : right(movingPiece)
          : side === "start" ? movingPiece.y : bottom(movingPiece);
        const targets = axis === "x" ? [targetPiece.x, right(targetPiece)] : [targetPiece.y, bottom(targetPiece)];
        for (const target of targets) {
          const delta = edgeDelta(movingPiece, options.previous ? parts(options.previous)[index] : box,
            axis, side, target, options);
          const next = adjustEdge(box, axis, side, delta, handle);
          if (Math.abs(target - edge) <= tolerance && Math.abs(delta) < distance && valid(next, options)) {
            best = next;
            distance = Math.abs(delta);
          }
        }
      }
    }
  }
  return best;
};

/** Magnetic edges and collisions use occupied pieces when supplied, or bounding boxes otherwise. */
export const snapAreaBounds = (candidate: AreaBounds, peers: SnapShape[], options: SnapOptions): AreaBounds => {
  const snapPeers = options.previous ? peers.filter((peer) => !shapesIntersect(options.previous!, peer)) : peers;
  const blockers = options.previous
    ? (options.blockers ?? peers).filter((peer) => !shapesIntersect(options.previous!, peer))
    : options.blockers ?? peers;
  const snapped = snapAxis(snapAxis(candidate, snapPeers, "x", options), snapPeers, "y", options);
  const collides = (box: AreaBounds, peer: SnapShape) => movedParts(box, options.previous).some((piece, i) =>
    parts(peer).some((target) => intersects(piece, target) ||
      (options.previous && sweptIntersects(parts(options.previous)[i], piece, target))));
  if (options.allowOverlap || !blockers.some((peer) => collides(snapped, peer))) return snapped;

  const collisions = blockers.filter((peer) => collides(snapped, peer));
  const xChoices = [0];
  const yChoices = [0];
  for (const shape of collisions) for (const peer of parts(shape)) for (const [index, piece] of movedParts(snapped, options.previous).entries()) {
    const original = options.previous ? parts(options.previous)[index] : candidate;
    if (!intersects(piece, peer) && !(options.previous && sweptIntersects(original, piece, peer))) continue;
    const fromLeft = options.previous && right(original) <= peer.x;
    const fromRight = options.previous && original.x >= right(peer);
    const fromTop = options.previous && bottom(original) <= peer.y;
    const fromBottom = options.previous && original.y >= bottom(peer);
    const xApproach = fromLeft || fromRight;
    const yApproach = fromTop || fromBottom;
    if (!yApproach || xApproach) {
      xChoices.push(edgeDelta(piece, original, "x", "start", right(peer), options));
      xChoices.push(edgeDelta(piece, original, "x", "end", peer.x, options));
    }
    if (!xApproach || yApproach) {
      yChoices.push(edgeDelta(piece, original, "y", "start", bottom(peer), options));
      yChoices.push(edgeDelta(piece, original, "y", "end", peer.y, options));
    }
  }

  let closest: AreaBounds | null = null;
  let distance = Infinity;
  for (const dx of xChoices) for (const dy of yChoices) {
    const xSide = options.handle === "move" || options.handle.includes("w") ? "start" : "end";
    const ySide = options.handle === "move" || options.handle.includes("n") ? "start" : "end";
    const next = adjustEdge(adjustEdge(snapped, "x", xSide, dx, options.handle), "y", ySide, dy, options.handle);
    const score = Math.abs(dx) + Math.abs(dy);
    if (score < distance && valid(next, options) && !blockers.some((peer) => collides(next, peer))) {
      closest = next;
      distance = score;
    }
  }
  return closest ?? options.previous ?? candidate;
};
