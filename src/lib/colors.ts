const hslRegex = /^(\d{1,3}(?:\.\d+)?)\s+(\d{1,3}(?:\.\d+)?)%\s+(\d{1,3}(?:\.\d+)?)%$/;

const componentToHex = (value: number) =>
  Math.round(value * 255)
    .toString(16)
    .padStart(2, "0");

export const hslToHex = (value: string, fallback = "#6b7280") => {
  const match = value.match(hslRegex);
  if (!match) return fallback;
  const h = (Number(match[1]) % 360) / 360;
  const s = Math.min(100, Math.max(0, Number(match[2]))) / 100;
  const l = Math.min(100, Math.max(0, Number(match[3]))) / 100;

  if (s === 0) return `#${componentToHex(l)}${componentToHex(l)}${componentToHex(l)}`;

  const hueToRgb = (p: number, q: number, tValue: number) => {
    let t = tValue;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return `#${componentToHex(hueToRgb(p, q, h + 1 / 3))}${componentToHex(hueToRgb(p, q, h))}${componentToHex(hueToRgb(p, q, h - 1 / 3))}`;
};

export const hexToHsl = (hex: string, fallback = "220 9% 46%") => {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return fallback;
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }

  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};
