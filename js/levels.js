/* levels.js — 3 màn chơi định nghĩa dạng dữ liệu (không ASCII để tránh lệch cột).
   - terrain: [c0, c1, topRow, (type: 1 đất | 2 đá)] → lấp từ topRow xuống đáy; cột không thuộc đoạn nào = vực.
   - solids:  [c0, c1, r0, r1, type] khối solid thêm (đảo nổi, tháp, tường).
   - oneways: [c0, c1, row] platform một chiều.
   - spikes:  [c0, c1, row] gai (đặt trên mặt đất bên dưới).
   - movers:  {c, r, axis:'x'|'y', min, max} platform di chuyển (min/max theo tile).
   - things:  [loại, col, row] — '@' spawn, o xu, h tim, s slime, b dơi, c checkpoint,
              T đuốc, E cửa thoát, G cổng boss, B boss, P công chúa.
   Quy ước toạ độ: thực thể đặt tại col/row có "chân" ở đáy ô đó = mặt ô dưới. */
"use strict";

const TILE = 48;
const KILL_MARGIN = 100;

const TILE_THEMES = {
  forest: {
    top: "#8FD65C",
    lip: "#C8F09A",
    body: "#8A5A3B",
    dark: "#6E4227",
    stoneTop: "#B8C4D4",
    stone: "#9AA7B8",
    stoneDark: "#7B8798",
    spike: "#8E99A8",
    spikeTip: "#E8EEF6",
    plank: "#B07B4A",
    deco: "flower",
  },
  sunset: {
    top: "#E8A56C",
    lip: "#FFD1A0",
    body: "#8A4E3E",
    dark: "#6B3A30",
    stoneTop: "#8E7898",
    stone: "#7A6480",
    stoneDark: "#5E4B66",
    spike: "#4A3A5C",
    spikeTip: "#B39BD4",
    plank: "#9C6248",
    deco: "grasslet",
  },
  castle: {
    top: "#6E6696",
    lip: "#938BC0",
    body: "#3A3556",
    dark: "#2B2742",
    stoneTop: "#565078",
    stone: "#4A4466",
    stoneDark: "#373250",
    spike: "#8B95B8",
    spikeTip: "#E4E9FF",
    plank: "#5A5378",
    deco: "crystal",
  },
};

const LEVELS = [
  // ================= MÀN 1 — RỪNG ÁNH SÁNG =================
  {
    name: "Rừng Ánh Sáng",
    sub: "Cuộc giải cứu bắt đầu",
    theme: "forest",
    W: 120,
    H: 16,
    terrain: [
      [0, 19, 13, 1],
      [23, 27, 13, 1],
      [28, 33, 11, 1],
      [37, 52, 13, 1],
      [53, 54, 12, 1],
      [55, 56, 11, 1],
      [57, 63, 10, 1],
      [67, 70, 10, 1],
      [71, 72, 11, 1],
      [73, 74, 12, 1],
      [75, 80, 13, 1],
      [85, 110, 13, 1],
      [111, 119, 12, 2],
    ],
    solids: [[49, 51, 10, 10, 1]], // đảo nổi (tim)
    oneways: [
      [34, 36, 11],
      [82, 83, 11],
    ],
    spikes: [],
    movers: [],
    things: [
      ["@", 3, 12],
      // xu
      ["o", 8, 12],
      ["o", 9, 12],
      ["o", 10, 12],
      ["o", 21, 11],
      ["o", 24, 12],
      ["o", 25, 12],
      ["o", 29, 10],
      ["o", 30, 10],
      ["o", 31, 10],
      ["o", 35, 9],
      ["o", 39, 12],
      ["o", 40, 12],
      ["o", 55, 10],
      ["o", 57, 9],
      ["o", 60, 8],
      ["o", 61, 8],
      ["o", 62, 8],
      ["o", 68, 8],
      ["o", 69, 8],
      ["o", 76, 12],
      ["o", 77, 12],
      ["o", 82, 10],
      ["o", 83, 10],
      ["o", 97, 12],
      ["o", 98, 12],
      ["o", 99, 12],
      ["h", 50, 9],
      // quái
      ["s", 16, 12],
      ["s", 26, 12],
      ["s", 41, 12],
      ["s", 47, 12],
      ["s", 32, 10],
      ["s", 87, 12],
      ["s", 95, 12],
      ["s", 105, 12],
      ["s", 56, 10],
      ["s", 68, 9],
      ["s", 79, 12],
      ["s", 100, 12],
      ["b", 60, 6],
      ["b", 89, 7],
      ["b", 35, 9],
      ["b", 72, 7],
      // hệ thống
      ["c", 45, 12],
      ["c", 92, 12],
      ["T", 111, 11],
      ["T", 116, 11],
      ["E", 113, 11],
    ],
  },

  // ================= MÀN 2 — VÁCH ĐÁ HOÀNG HÔN =================
  {
    name: "Vách Đá Hoàng Hôn",
    sub: "Gió nóng và vực sâu",
    theme: "sunset",
    W: 130,
    H: 16,
    terrain: [
      [0, 9, 13, 1],
      [10, 14, 12, 1],
      [19, 26, 12, 1],
      [27, 36, 13, 1],
      [41, 48, 12, 1],
      [49, 52, 11, 1],
      [56, 64, 11, 1],
      [69, 92, 12, 1],
      [97, 118, 11, 1],
      [122, 129, 10, 2],
    ],
    solids: [[87, 89, 8, 8, 1]], // đảo nổi (tim)
    oneways: [],
    spikes: [
      [27, 29, 12],
      [78, 80, 11],
      [106, 108, 10],
    ],
    movers: [
      { c: 16, r: 12, axis: "x", min: 15.1, max: 17.9 },
      { c: 38, r: 11, axis: "x", min: 37.1, max: 39.9 },
      { c: 94, r: 10, axis: "x", min: 93.1, max: 95.9 },
      { c: 66, r: 11, axis: "y", min: 9, max: 13 },
    ],
    things: [
      ["@", 3, 12],
      ["o", 11, 11],
      ["o", 12, 11],
      ["o", 13, 11],
      ["o", 16, 10],
      ["o", 17, 10],
      ["o", 21, 11],
      ["o", 22, 11],
      ["o", 23, 11],
      ["o", 28, 10],
      ["o", 31, 12],
      ["o", 32, 12],
      ["o", 38, 9],
      ["o", 39, 9],
      ["o", 50, 10],
      ["o", 51, 10],
      ["o", 54, 9],
      ["o", 59, 10],
      ["o", 60, 10],
      ["o", 61, 10],
      ["o", 66, 8],
      ["o", 71, 11],
      ["o", 72, 11],
      ["o", 73, 11],
      ["o", 79, 10],
      ["o", 83, 11],
      ["o", 84, 11],
      ["o", 91, 11],
      ["o", 92, 11],
      ["o", 94, 8],
      ["o", 95, 8],
      ["o", 98, 10],
      ["o", 99, 10],
      ["o", 103, 10],
      ["o", 104, 10],
      ["o", 107, 9],
      ["o", 113, 10],
      ["o", 114, 10],
      ["o", 116, 10],
      ["o", 117, 10],
      ["h", 88, 7],
      ["s", 33, 12],
      ["s", 85, 11],
      ["s", 90, 11],
      ["s", 115, 10],
      ["s", 25, 11],
      ["s", 46, 11],
      ["s", 76, 11],
      ["s", 101, 10],
      ["b", 45, 7],
      ["b", 62, 6],
      ["b", 100, 5],
      ["b", 30, 9],
      ["b", 54, 7],
      ["b", 85, 7],
      ["b", 115, 7],
      ["c", 58, 10],
      ["c", 111, 10],
      ["T", 124, 9],
      ["T", 128, 9],
      ["E", 126, 9],
    ],
  },

  // ================= MÀN 3 — LÂU ĐÀI BÓNG ĐÊM =================
  {
    name: "Lâu Đài Bóng Đêm",
    sub: "Hắc Kỵ Sĩ chờ ngươi",
    theme: "castle",
    W: 116,
    H: 16,
    terrain: [
      [0, 7, 13, 2],
      [11, 18, 12, 2],
      [23, 30, 12, 2],
      [31, 34, 11, 2],
      [39, 58, 11, 2],
      [63, 70, 10, 2],
      [75, 94, 10, 2],
      [99, 115, 12, 2],
    ],
    solids: [
      [112, 114, 8, 11, 2], // tháp công chúa
      [115, 115, 0, 11, 2], // tường cuối màn
    ],
    oneways: [],
    spikes: [
      [29, 30, 11],
      [47, 49, 10],
      [83, 85, 9],
      [17, 18, 11],
      [90, 91, 9],
    ],
    movers: [
      { c: 20, r: 11, axis: "x", min: 19.1, max: 21.9 },
      { c: 60, r: 9, axis: "x", min: 59.1, max: 61.9 },
      { c: 36, r: 10, axis: "y", min: 8, max: 12 },
      { c: 96, r: 9, axis: "y", min: 7, max: 12 },
    ],
    things: [
      ["@", 3, 12],
      ["T", 6, 12],
      ["T", 14, 11],
      ["T", 65, 9],
      ["T", 92, 9],
      ["T", 102, 11],
      ["T", 112, 7],
      ["o", 4, 11],
      ["o", 5, 11],
      ["o", 12, 11],
      ["o", 13, 11],
      ["o", 20, 9],
      ["o", 21, 9],
      ["o", 24, 11],
      ["o", 27, 11],
      ["o", 32, 10],
      ["o", 33, 10],
      ["o", 36, 7],
      ["o", 40, 10],
      ["o", 41, 10],
      ["o", 45, 10],
      ["o", 48, 9],
      ["o", 52, 10],
      ["o", 53, 10],
      ["o", 56, 10],
      ["o", 57, 10],
      ["o", 60, 8],
      ["o", 61, 8],
      ["o", 64, 9],
      ["o", 67, 9],
      ["o", 68, 9],
      ["o", 72, 9],
      ["o", 73, 9],
      ["o", 76, 9],
      ["o", 77, 9],
      ["o", 81, 9],
      ["o", 84, 8],
      ["o", 88, 9],
      ["h", 93, 9],
      ["s", 25, 11],
      ["s", 54, 10],
      ["s", 78, 9],
      ["s", 13, 11],
      ["s", 43, 10],
      ["s", 66, 9],
      ["b", 42, 6],
      ["b", 80, 5],
      ["b", 28, 7],
      ["b", 58, 7],
      ["b", 87, 5],
      ["c", 44, 10],
      ["c", 89, 9],
      ["c", 100, 11],
      ["G", 103, 11],
      ["B", 108, 11],
      ["P", 113, 7],
    ],
  },
];

// Trả về cấu trúc màn đã dựng sẵn cho engine
function parseLevel(idx) {
  const L = LEVELS[idx];
  const { W, H } = L;
  const grid = new Uint8Array(W * H); // 0 trống | 1 đất | 2 đá | 3 oneway | 4 gai
  const set = (c, r, v) => {
    if (c >= 0 && c < W && r >= 0 && r < H) grid[r * W + c] = v;
  };

  for (const [c0, c1, top, type] of L.terrain)
    for (let c = c0; c <= c1; c++)
      for (let r = top; r < H; r++) set(c, r, type || 1);
  for (const [c0, c1, r0, r1, type] of L.solids || [])
    for (let c = c0; c <= c1; c++)
      for (let r = r0; r <= r1; r++) set(c, r, type || 1);
  for (const [c0, c1, r] of L.oneways || [])
    for (let c = c0; c <= c1; c++) set(c, r, 3);
  for (const [c0, c1, r] of L.spikes || [])
    for (let c = c0; c <= c1; c++) set(c, r, 4);

  const out = {
    idx,
    w: W,
    h: H,
    grid,
    widthPx: W * TILE,
    heightPx: H * TILE,
    theme: L.theme,
    tileTheme: TILE_THEMES[L.theme],
    name: L.name,
    sub: L.sub,
    spawn: null,
    coins: [],
    hearts: [],
    slimes: [],
    bats: [],
    checks: [],
    torches: [],
    door: null,
    boss: null,
    gate: null,
    princess: null,
    movers: (L.movers || []).map((m) => ({
      x: m.c * TILE + TILE / 2,
      y: (m.r + 1) * TILE,
      axis: m.axis,
      min: m.min * TILE,
      max: m.max * TILE,
    })),
  };

  for (const [t, c, r] of L.things) {
    const cx = c * TILE + TILE / 2; // tâm ngang
    const base = (r + 1) * TILE; // "chân" thực thể
    const center = r * TILE + TILE / 2; // tâm ô (cho xu/tim)
    switch (t) {
      case "@":
        out.spawn = { x: cx, y: base };
        break;
      case "o":
        out.coins.push({ x: cx, y: center });
        break;
      case "h":
        out.hearts.push({ x: cx, y: center });
        break;
      case "s":
        out.slimes.push({ x: cx, y: base });
        break;
      case "b":
        out.bats.push({ x: cx, y: center });
        break;
      case "c":
        out.checks.push({ x: cx, y: base });
        break;
      case "T":
        out.torches.push({ x: cx, y: base });
        break;
      case "E":
        out.door = { x: cx, y: base };
        break;
      case "G":
        out.gate = { x: cx, y: base };
        break;
      case "B":
        out.boss = { x: cx, y: base };
        break;
      case "P":
        out.princess = { x: cx, y: base };
        break;
    }
  }
  return out;
}
