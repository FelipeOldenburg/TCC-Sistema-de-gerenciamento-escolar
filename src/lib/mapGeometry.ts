export type AreaAdjustment = {
  ajuste_x?: number | null;
  ajuste_y?: number | null;
  escala_x?: number | null;
  escala_y?: number | null;
};

export type AreaBounds = { x: number; y: number; width: number; height: number };

export const areaTransform = (area: AreaAdjustment) =>
  `matrix(${area.escala_x ?? 1} 0 0 ${area.escala_y ?? 1} ${area.ajuste_x ?? 0} ${area.ajuste_y ?? 0})`;

export const adjustedPoint = (x: number, y: number, area: AreaAdjustment) => ({
  x: x * (area.escala_x ?? 1) + (area.ajuste_x ?? 0),
  y: y * (area.escala_y ?? 1) + (area.ajuste_y ?? 0),
});

export const adjustedBounds = (box: AreaBounds, area: AreaAdjustment): AreaBounds => ({
  ...adjustedPoint(box.x, box.y, area),
  width: box.width * (area.escala_x ?? 1),
  height: box.height * (area.escala_y ?? 1),
});
