/* util.js — toán, RNG, easing, helper vẽ */
"use strict";

// cập nhật thủ công mỗi lần sửa game (không có build system)
const GAME_INFO = { version: "1.5.0", built: "02/09/2026 10:25" };

const TAU = Math.PI * 2;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
// exp smoothing độc lập framerate
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
const rand = (a = 1, b) =>
  b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const chance = (p) => Math.random() < p;

// RNG có seed (cho decor ổn định giữa các frame)
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => t * (2 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  outCubic: (t) => 1 + --t * t * t,
  inCubic: (t) => t * t * t,
  outBack: (t) => {
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  },
  outElastic: (t) =>
    t === 0
      ? 0
      : t === 1
        ? 1
        : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1,
};

const aabb = (ax, ay, aw, ah, bx, by, bw, bh) =>
  ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

function makeCanvas(w, h) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  return { cv, cx: cv.getContext("2d") };
}

// sprite glow radial pre-render (tránh shadowBlur trong hot path)
const _glowCache = new Map();
function glowTex(color, size = 64) {
  const key = color + "|" + size;
  let tex = _glowCache.get(key);
  if (tex) return tex;
  const { cv, cx } = makeCanvas(size, size);
  const g = cx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  g.addColorStop(0, color);
  g.addColorStop(0.35, hexA(color, 0.45));
  g.addColorStop(1, hexA(color, 0));
  cx.fillStyle = g;
  cx.fillRect(0, 0, size, size);
  _glowCache.set(key, cv);
  return cv;
}

// '#RRGGBB' + alpha -> rgba()
function hexA(hex, a) {
  if (hex[0] !== "#") return hex; // đã là rgba/hsl
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

// trộn 2 màu hex theo t
function mixHex(h1, h2, t) {
  const n1 = parseInt(h1.slice(1), 16),
    n2 = parseInt(h2.slice(1), 16);
  const r = Math.round(lerp((n1 >> 16) & 255, (n2 >> 16) & 255, t));
  const g = Math.round(lerp((n1 >> 8) & 255, (n2 >> 8) & 255, t));
  const b = Math.round(lerp(n1 & 255, n2 & 255, t));
  return `rgb(${r},${g},${b})`;
}

function roundRectPath(ctx, x, y, w, h, r) {
  if (typeof r === "number") r = { tl: r, tr: r, br: r, bl: r };
  ctx.beginPath();
  ctx.moveTo(x + r.tl, y);
  ctx.lineTo(x + w - r.tr, y);
  ctx.arcTo(x + w, y, x + w, y + r.tr, r.tr);
  ctx.lineTo(x + w, y + h - r.br);
  ctx.arcTo(x + w, y + h, x + w - r.br, y + h, r.br);
  ctx.lineTo(x + r.bl, y + h);
  ctx.arcTo(x, y + h, x, y + h - r.bl, r.bl);
  ctx.lineTo(x, y + r.tl);
  ctx.arcTo(x, y, x + r.tl, y, r.tl);
  ctx.closePath();
}

function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.3);
  ctx.bezierCurveTo(x, y, x - s * 0.5, y - s * 0.15, x - s * 0.5, y + s * 0.15);
  ctx.bezierCurveTo(
    x - s * 0.5,
    y + s * 0.45,
    x - s * 0.15,
    y + s * 0.65,
    x,
    y + s * 0.85,
  );
  ctx.bezierCurveTo(
    x + s * 0.15,
    y + s * 0.65,
    x + s * 0.5,
    y + s * 0.45,
    x + s * 0.5,
    y + s * 0.15,
  );
  ctx.bezierCurveTo(x + s * 0.5, y - s * 0.15, x, y, x, y + s * 0.3);
  ctx.closePath();
}

function starPath(ctx, x, y, r, points = 5, inset = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rr = i % 2 === 0 ? r : r * inset;
    const a = (i / (points * 2)) * TAU - Math.PI / 2;
    const px = x + Math.cos(a) * rr,
      py = y + Math.sin(a) * rr;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
}
