import React, { useRef, useEffect } from 'react';

type Prism = { id: string; color: string; x: number; y: number; w: number; d: number; h: number };

const prisms: Prism[] = [
  { id: 'base-left', color: '#e5e7eb', x: 0, y: 0, w: 28, d: 8, h: 1.2 },
  { id: 'base-right', color: '#e5e7eb', x: 40, y: 0, w: 28, d: 8, h: 1.2 },
  { id: 'arm-left', color: '#d1d5db', x: 0, y: 16, w: 20, d: 8, h: 1.2 },
  { id: 'arm-right', color: '#d1d5db', x: 32, y: 16, w: 28, d: 8, h: 1.2 },
  { id: 'roof', color: '#6b7280', x: 56, y: -8, w: 20, d: 8, h: 1.6 },
];

function shade(hex: string, percent: number) {
  const c = hex.replace('#', '');
  const num = parseInt(c, 16);
  let r = (num >> 16) + Math.round(255 * percent);
  let g = ((num >> 8) & 0x00ff) + Math.round(255 * percent);
  let b = (num & 0x0000ff) + Math.round(255 * percent);
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `rgb(${r},${g},${b})`;
}

export default function Map3DNew() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, '#fbfdff');
    g.addColorStop(1, '#f1f5f9');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const scale = 9;
    const offsetX = 120;
    const offsetY = 200;

    const project = (x: number, y: number, z: number) => {
      const isoX = (x - y) * Math.cos(Math.PI / 6);
      const isoY = (x + y) * Math.sin(Math.PI / 6) - z;
      return [offsetX + isoX * scale, offsetY + isoY * scale];
    };

    const sorted = [...prisms].sort((a, b) => a.x + a.y - (b.x + b.y));

    sorted.forEach(pr => {
      const corners = [
        [pr.x, pr.y, 0],
        [pr.x + pr.w, pr.y, 0],
        [pr.x + pr.w, pr.y + pr.d, 0],
        [pr.x, pr.y + pr.d, 0],
        [pr.x, pr.y, pr.h],
        [pr.x + pr.w, pr.y, pr.h],
        [pr.x + pr.w, pr.y + pr.d, pr.h],
        [pr.x, pr.y + pr.d, pr.h],
      ];

      const p = corners.map(c => project(c[0], c[1], c[2]));

      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.beginPath();
      ctx.moveTo(p[0][0], p[0][1] + 10);
      ctx.lineTo(p[1][0], p[1][1] + 10);
      ctx.lineTo(p[2][0], p[2][1] + 10);
      ctx.lineTo(p[3][0], p[3][1] + 10);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(p[0][0], p[0][1]);
      ctx.lineTo(p[1][0], p[1][1]);
      ctx.lineTo(p[5][0], p[5][1]);
      ctx.lineTo(p[4][0], p[4][1]);
      ctx.closePath();
      ctx.fillStyle = pr.color;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(p[1][0], p[1][1]);
      ctx.lineTo(p[2][0], p[2][1]);
      ctx.lineTo(p[6][0], p[6][1]);
      ctx.lineTo(p[5][0], p[5][1]);
      ctx.closePath();
      ctx.fillStyle = shade(pr.color, -0.06);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(p[4][0], p[4][1]);
      ctx.lineTo(p[5][0], p[5][1]);
      ctx.lineTo(p[6][0], p[6][1]);
      ctx.lineTo(p[7][0], p[7][1]);
      ctx.closePath();
      ctx.fillStyle = shade(pr.color, 0.04);
      ctx.fill();

      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(p[0][0], p[0][1]);
      ctx.lineTo(p[1][0], p[1][1]);
      ctx.lineTo(p[2][0], p[2][1]);
      ctx.lineTo(p[3][0], p[3][1]);
      ctx.closePath();
      ctx.stroke();

      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p[4][0], p[4][1]);
      ctx.lineTo(p[5][0], p[5][1]);
      ctx.lineTo(p[6][0], p[6][1]);
      ctx.lineTo(p[7][0], p[7][1]);
      ctx.closePath();
      ctx.stroke();
    });

    ctx.fillStyle = 'rgba(0,0,0,0.04)';
    ctx.fillRect(20, canvas.height - 28, canvas.width - 40, 8);
  }, []);

  return (
    <div className="w-full space-y-6">
      <div className="glass-card rounded-2xl p-6">
        <h3 className="font-heading font-bold text-card-foreground mb-2">Planta 3D (ilustrativa)</h3>
        <p className="text-sm text-muted-foreground mb-4">Modelo isométrico estático inspirado na referência</p>
        <div className="flex justify-center bg-white rounded-lg p-4">
          <canvas ref={canvasRef} width={900} height={420} className="w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
