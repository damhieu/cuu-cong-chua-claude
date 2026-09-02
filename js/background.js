/* background.js — bầu trời + parallax nhiều lớp theo theme, pre-render offscreen.
   Signature: "ánh sáng dẫn đường" — ánh đèn nơi tháp công chúa luôn hiện ở chân trời,
   tiến gần hơn theo tiến độ màn. */
"use strict";

const VIEW_W = 960,
  VIEW_H = 540;

const Background = {
  theme: null,
  name: "",
  levelW: 0,
  levelH: 0,
  layers: [], // {cv, f, y}
  clouds: [], // {x,y,s,spd,cv}
  ambient: [], // particle nhẹ theo theme
  stars: null,
  t: 0,

  themes: {
    forest: {
      sky: ["#8ED8F0", "#BDEBDD", "#F3F7CF"],
      sun: { x: 0.78, y: 0.2, r: 46, color: "#FFF6C9" },
      rays: true,
      cloud: ["#ffffff", "#e8f7f1"],
      layerDefs: [
        {
          kind: "mountain",
          color: "#9BD4C0",
          h: 200,
          f: 0.08,
          rough: 60,
          seed: 11,
        },
        {
          kind: "mountain",
          color: "#63B89B",
          h: 150,
          f: 0.16,
          rough: 45,
          seed: 22,
        },
        { kind: "trees", color: "#3E8E6E", h: 120, f: 0.3, seed: 33 },
        { kind: "trees", color: "#2E6E55", h: 78, f: 0.5, seed: 44 },
      ],
      ambient: "leaves",
      lightGlow: "#FFE9A8",
      lightScale: 0.7,
      lightY: 0.54,
      bgSrc: "assets/bg-forest.jpg", // tranh nền AI; ảnh đã có tháp + tia
      bgF: 0.08,
      bgReplaceN: 2, // ảnh thay 2 lớp núi xa nhất
      hasBakedLight: true,
      bgYOff: -8,
      bgSkyRays: false, // ảnh đã có god rays
    },
    sunset: {
      sky: ["#5C3B8F", "#C4548A", "#FF9A6C", "#FFD97A"],
      sun: { x: 0.62, y: 0.58, r: 64, color: "#FFE9B8" },
      rays: false,
      cloud: ["#F7B2C4", "#E38FB4"],
      layerDefs: [
        {
          kind: "mountain",
          color: "#7A4E8F",
          h: 210,
          f: 0.08,
          rough: 80,
          seed: 55,
        },
        { kind: "mesa", color: "#5D3A78", h: 160, f: 0.18, seed: 66 },
        { kind: "mesa", color: "#432A5E", h: 110, f: 0.34, seed: 77 },
        { kind: "rocks", color: "#2E1D45", h: 70, f: 0.55, seed: 88 },
      ],
      ambient: "motes",
      lightGlow: "#FFD166",
      lightScale: 1.05,
      lightY: 0.48,
      bgSrc: "assets/bg-sunset.jpg",
      bgF: 0.08,
      bgReplaceN: 2,
      hasBakedLight: true,
      bgYOff: -8,
    },
    castle: {
      sky: ["#0E1220", "#1B1F3B", "#3D2C63"],
      moon: { x: 0.72, y: 0.18, r: 40 },
      rays: false,
      cloud: ["#2A2F52", "#232746"],
      layerDefs: [
        {
          kind: "mountain",
          color: "#181C33",
          h: 220,
          f: 0.07,
          rough: 90,
          seed: 99,
        },
        { kind: "castle", color: "#121531", h: 230, f: 0.16, seed: 111 },
        {
          kind: "trees",
          color: "#0C0F22",
          h: 90,
          f: 0.38,
          seed: 122,
          pine: true,
        },
        { kind: "rocks", color: "#080A18", h: 56, f: 0.58, seed: 133 },
      ],
      ambient: "embers",
      fog: true,
      lightGlow: "#FFD166",
      lightScale: 1.7,
      lightY: 0.5,
      bgSrc: "assets/bg-castle.jpg", // ảnh KHÔNG có lâu đài (code vẽ skyline riêng)
      bgF: 0.07,
      bgReplaceN: 1, // chỉ thay lớp núi xa nhất, GIỮ skyline lâu đài (identity)
      hasBakedLight: false, // ảnh không có tháp → vẫn vẽ ánh sáng dẫn đường động
      bgYOff: -8,
    },
  },

  build(name, levelW, levelH) {
    const th = this.themes[name];
    this.theme = th;
    this.name = name;
    this.levelW = levelW;
    this.levelH = levelH;
    this.layers = [];
    for (const def of th.layerDefs) this.layers.push(this._makeLayer(def));
    // mây
    this.clouds = [];
    const rng = mulberry32(7);
    for (let i = 0; i < 6; i++) {
      this.clouds.push({
        x: rng() * VIEW_W * 1.6,
        y: 30 + rng() * 150,
        s: 0.5 + rng() * 0.9,
        spd: 3 + rng() * 7,
        cv: this._makeCloud(90 + rng() * 90, th.cloud, 200 + i),
      });
    }
    // sao (đêm)
    this.stars = null;
    if (name === "castle") {
      const { cv, cx } = makeCanvas(VIEW_W, 300);
      const r2 = mulberry32(31);
      for (let i = 0; i < 130; i++) {
        const x = r2() * VIEW_W,
          y = r2() * 290,
          s = r2() * 1.6 + 0.4;
        cx.globalAlpha = 0.35 + r2() * 0.65;
        cx.fillStyle = r2() < 0.12 ? "#FFE9A8" : "#DDE7FF";
        cx.beginPath();
        cx.arc(x, y, s, 0, TAU);
        cx.fill();
      }
      this.stars = cv;
    }
    // ambient
    this.ambient = [];
    const n = th.ambient === "embers" ? 26 : th.ambient === "leaves" ? 24 : 34;
    for (let i = 0; i < n; i++) this.ambient.push(this._newAmbient(true));
    // tia nắng mềm pre-render
    this.raysTex = th.rays ? this._makeRays() : null;
    // tranh nền AI (tải bất đồng bộ; nếu lỗi/chưa xong → tự dùng renderer vẽ tay)
    this.bgImg = th.bgSrc ? this._loadBg(th.bgSrc) : null;
  },

  _bgCache: {},
  _loadBg(src) {
    let img = this._bgCache[src];
    if (img) return img;
    img = new Image();
    img.__ready = false;
    img.onload = () => {
      img.__ready = true;
    };
    img.onerror = () => {
      img.__ready = false;
      img.__failed = true;
    };
    img.src = src;
    this._bgCache[src] = img;
    return img;
  },

  // quạt tia nắng mềm: mỗi tia vẽ chồng 3 lớp (rộng dần, mờ dần) → mép tia
  // không còn cứng; toàn quạt mờ dần theo chiều dài
  _makeRays() {
    const S = 1000;
    const { cv, cx } = makeCanvas(S, S);
    const rng = mulberry32(77);
    cx.translate(S / 2, S / 2);
    const rays = 9;
    for (let i = 0; i < rays; i++) {
      // toả chủ yếu xuống dưới-trái (mặt trời ở góc phải trên)
      const a = 1.62 + (i / (rays - 1)) * 1.35 + (rng() - 0.5) * 0.08;
      const len = 340 + rng() * 150;
      const wEnd = 26 + rng() * 44;
      const boost = rng() < 0.3 ? 1.5 : 1;
      cx.save();
      cx.rotate(a);
      for (const [wMul, al] of [
        [1, 0.05],
        [0.62, 0.045],
        [0.3, 0.05],
      ]) {
        const w = wEnd * wMul;
        const g = cx.createLinearGradient(0, 0, len, 0);
        g.addColorStop(0, `rgba(255,246,200,${al * boost})`);
        g.addColorStop(0.55, `rgba(255,246,200,${al * 0.7 * boost})`);
        g.addColorStop(1, "rgba(255,246,200,0)");
        cx.fillStyle = g;
        cx.beginPath();
        cx.moveTo(26, -2);
        cx.lineTo(len, -w / 2);
        cx.quadraticCurveTo(len + w * 0.4, 0, len, w / 2);
        cx.lineTo(26, 2);
        cx.closePath();
        cx.fill();
      }
      cx.restore();
    }
    return cv;
  },

  _newAmbient(anywhere) {
    const kind = this.theme.ambient;
    const x = rand(0, VIEW_W),
      y = anywhere ? rand(0, VIEW_H) : kind === "embers" ? VIEW_H + 10 : -10;
    if (kind === "leaves")
      return {
        x,
        y,
        vx: rand(-30, -12),
        vy: rand(14, 30),
        ph: rand(0, TAU),
        s: rand(1.8, 3.4),
        kind,
      };
    if (kind === "motes")
      return {
        x,
        y,
        vx: rand(-14, -5),
        vy: rand(-4, 4),
        ph: rand(0, TAU),
        s: rand(1.2, 2.6),
        kind,
      };
    return {
      x,
      y,
      vx: rand(-8, 8),
      vy: rand(-34, -16),
      ph: rand(0, TAU),
      s: rand(1.4, 3),
      kind,
    }; // embers
  },

  update(dt) {
    this.t += dt;
    for (const c of this.clouds) {
      c.x -= c.spd * dt * c.s;
      if (c.x < -260) {
        c.x = VIEW_W + rand(40, 200);
        c.y = 30 + rand(0, 150);
      }
    }
    for (let i = 0; i < this.ambient.length; i++) {
      const a = this.ambient[i];
      a.ph += dt * 2;
      a.x += (a.vx + Math.sin(a.ph) * 10) * dt;
      a.y += (a.vy + (a.kind === "leaves" ? Math.cos(a.ph * 0.7) * 8 : 0)) * dt;
      if (a.y > VIEW_H + 14 || a.y < -14 || a.x < -14 || a.x > VIEW_W + 14)
        this.ambient[i] = this._newAmbient(false);
    }
  },

  // ---------- pre-render ----------
  _makeLayer(def) {
    const W = 1280,
      H = def.h + 40;
    const { cv, cx } = makeCanvas(W, H);
    const rng = mulberry32(def.seed);
    cx.fillStyle = def.color;
    if (def.kind === "mountain") {
      // đường núi tileable bằng noise sin tổng hợp
      const base = 30 + rng() * 20;
      cx.beginPath();
      cx.moveTo(0, H);
      const a1 = 1 + rng() * 2,
        a2 = 2 + rng() * 3,
        p1 = rng() * TAU,
        p2 = rng() * TAU;
      for (let x = 0; x <= W; x += 8) {
        const u = (x / W) * TAU;
        const yy =
          base +
          Math.sin(u * a1 + p1) * def.rough +
          Math.sin(u * a2 + p2) * def.rough * 0.45 +
          Math.sin(u * 7 + p1 * 2) * def.rough * 0.12;
        cx.lineTo(x, clamp(yy, 8, H - 20));
      }
      cx.lineTo(W, H);
      cx.closePath();
      cx.fill();
      // tuyết/sáng đỉnh nhẹ
      cx.globalAlpha = 0.12;
      cx.fillStyle = "#ffffff";
      cx.fill();
      cx.globalAlpha = 1;
    } else if (def.kind === "mesa") {
      let x = 0;
      cx.beginPath();
      cx.moveTo(0, H);
      while (x < W) {
        const w = 60 + rng() * 140,
          top = 20 + rng() * (def.h - 50);
        cx.lineTo(x, H);
        cx.lineTo(x + 8, top + 14);
        cx.lineTo(x + 16, top);
        cx.lineTo(x + w - 16, top);
        cx.lineTo(x + w - 8, top + 14);
        cx.lineTo(x + w, H);
        x += w + 20 + rng() * 60;
      }
      cx.lineTo(W, H);
      cx.closePath();
      cx.fill();
    } else if (def.kind === "trees") {
      cx.fillRect(0, H - 26, W, 26);
      let x = 6;
      while (x < W) {
        const s = 0.6 + rng() * 0.9;
        if (def.pine) {
          const th2 = H - 20,
            hh = 60 * s;
          cx.beginPath();
          cx.moveTo(x, th2);
          cx.lineTo(x + 14 * s, th2 - hh);
          cx.lineTo(x + 28 * s, th2);
          cx.closePath();
          cx.fill();
        } else {
          const cyy = H - 30 - 26 * s;
          cx.beginPath();
          cx.arc(x + 14 * s, cyy, 20 * s, 0, TAU);
          cx.arc(x + 30 * s, cyy + 8 * s, 16 * s, 0, TAU);
          cx.arc(x - 2 * s, cyy + 9 * s, 14 * s, 0, TAU);
          cx.fill();
          cx.fillRect(x + 11 * s, cyy, 6 * s, H - cyy - 20);
        }
        x += 34 * s + rng() * 46;
      }
    } else if (def.kind === "rocks") {
      cx.fillRect(0, H - 22, W, 22);
      let x = 0;
      while (x < W) {
        const w = 30 + rng() * 70,
          hh = 14 + rng() * (def.h - 30);
        cx.beginPath();
        cx.moveTo(x, H);
        cx.lineTo(x + w * 0.2, H - hh);
        cx.lineTo(x + w * 0.7, H - hh * 0.8);
        cx.lineTo(x + w, H);
        cx.closePath();
        cx.fill();
        x += w + rng() * 50;
      }
    } else if (def.kind === "castle") {
      // skyline lâu đài: tường + tháp + cửa sổ sáng
      const ground = H - 20;
      cx.fillRect(0, ground, W, 20);
      let x = 30;
      while (x < W - 80) {
        const isTower = rng() < 0.45;
        const w = isTower ? 34 + rng() * 30 : 70 + rng() * 110;
        const hh = isTower ? 90 + rng() * 110 : 40 + rng() * 60;
        const top = ground - hh;
        cx.fillRect(x, top, w, hh);
        if (isTower) {
          cx.beginPath(); // mái chóp
          cx.moveTo(x - 5, top);
          cx.lineTo(x + w / 2, top - 26 - rng() * 18);
          cx.lineTo(x + w + 5, top);
          cx.closePath();
          cx.fill();
        } else {
          for (let cx2 = x; cx2 < x + w - 8; cx2 += 12)
            cx.fillRect(cx2, top - 7, 7, 7); // răng cưa
        }
        // cửa sổ sáng
        const wn = 1 + ((rng() * 3) | 0);
        for (let k = 0; k < wn; k++) {
          const wx = x + 6 + rng() * (w - 14),
            wy = top + 12 + rng() * (hh - 26);
          cx.fillStyle = rng() < 0.7 ? "#FFC96B" : "#FFE9A8";
          cx.globalAlpha = 0.85;
          cx.fillRect(wx, wy, 4, 6);
          cx.globalAlpha = 1;
          cx.fillStyle = def.color;
        }
        x += w + 12 + rng() * 40;
      }
    }
    return { cv, f: def.f, h: H };
  },

  _makeCloud(w, colors, seed) {
    const rng = mulberry32(seed);
    const h = w * 0.42;
    const { cv, cx } = makeCanvas(w, h);
    const g = cx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, colors[0]);
    g.addColorStop(1, colors[1]);
    cx.fillStyle = g;
    const n = 5 + ((rng() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const rx = w * 0.12 + rng() * w * 0.16;
      cx.beginPath();
      cx.ellipse(
        rx + rng() * (w - rx * 2),
        h * 0.55 + rng() * h * 0.2,
        rx,
        rx * 0.62,
        0,
        0,
        TAU,
      );
      cx.fill();
    }
    return cv;
  },

  // ---------- draw ----------
  draw(ctx, camX, camY) {
    const th = this.theme;
    if (!th) return;
    const useImg = this.bgImg && this.bgImg.__ready;

    if (useImg) {
      // tranh nền AI thay bầu trời + mặt trời/trăng + sao + mây tĩnh
      this._drawBgImage(ctx, camX, camY);
    } else {
      this._drawSky(ctx, camX, camY);
    }
    // ánh sáng dẫn đường: bỏ khi ảnh đã "nướng" sẵn tháp + tia (forest/sunset);
    // vẫn vẽ động cho castle (ảnh không có tháp) và cho mọi renderer vẽ tay
    if (!(useImg && th.hasBakedLight)) this._drawGuidingLight(ctx, camX);
    // các lớp parallax: ảnh thay bgReplaceN lớp xa nhất
    const start = useImg ? th.bgReplaceN || 0 : 0;
    for (let i = start; i < this.layers.length; i++) {
      const L = this.layers[i];
      const off =
        ((((-camX * L.f) % L.cv.width) + L.cv.width) % L.cv.width) - L.cv.width;
      const y = VIEW_H - L.h + 10 - camY * L.f * 0.35;
      for (let x = off; x < VIEW_W; x += L.cv.width)
        ctx.drawImage(L.cv, Math.round(x), Math.round(y));
    }
  },

  // vẽ tranh nền: 1 ảnh duy nhất, đủ rộng để phủ cả tầm cuộn (không tile → không
  // lộ mép nối, không nhân đôi mặt trời), parallax ngang chậm như lớp xa nhất
  _drawBgImage(ctx, camX, camY) {
    const img = this.bgImg,
      th = this.theme;
    const F = th.bgF || 0.08;
    const scrollRange = this.levelW * F;
    let w = VIEW_W + scrollRange + 80;
    let h = (w * img.height) / img.width;
    const minH = VIEW_H + 60;
    if (h < minH) {
      h = minH;
      w = (h * img.width) / img.height;
    }
    const xOff = -camX * F;
    const yOff = (th.bgYOff || 0) - camY * 0.03;
    ctx.drawImage(img, Math.round(xOff), Math.round(yOff), w, h);
  },

  _drawSky(ctx, camX, camY) {
    const th = this.theme;
    // bầu trời
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    const n = th.sky.length;
    th.sky.forEach((c, i) => g.addColorStop(i / (n - 1), c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // sao
    if (this.stars) {
      ctx.globalAlpha = 0.9;
      ctx.drawImage(this.stars, 0, 0);
      ctx.globalAlpha = 1;
    }
    // mặt trời / trăng
    if (th.sun) {
      const sx = th.sun.x * VIEW_W,
        sy = th.sun.y * VIEW_H;
      ctx.drawImage(
        glowTex(th.sun.color, 128),
        sx - th.sun.r * 3,
        sy - th.sun.r * 3,
        th.sun.r * 6,
        th.sun.r * 6,
      );
      ctx.fillStyle = th.sun.color;
      ctx.beginPath();
      ctx.arc(sx, sy, th.sun.r, 0, TAU);
      ctx.fill();
    }
    if (th.moon) {
      const sx = th.moon.x * VIEW_W,
        sy = th.moon.y * VIEW_H,
        r = th.moon.r;
      ctx.drawImage(
        glowTex("#C9D6FF", 128),
        sx - r * 3.4,
        sy - r * 3.4,
        r * 6.8,
        r * 6.8,
      );
      ctx.fillStyle = "#EDF2FF";
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = hexA("#B9C6EE", 0.55);
      ctx.beginPath();
      ctx.arc(sx - r * 0.3, sy - r * 0.15, r * 0.24, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx + r * 0.25, sy + r * 0.3, r * 0.16, 0, TAU);
      ctx.fill();
    }
    // mây (giữa các lớp xa)
    for (const c of this.clouds) {
      ctx.globalAlpha = 0.8;
      ctx.drawImage(
        c.cv,
        c.x,
        c.y - camY * 0.05,
        c.cv.width * c.s,
        c.cv.height * c.s,
      );
      ctx.globalAlpha = 1;
    }
  },

  _drawGuidingLight(ctx, camX) {
    const th = this.theme;
    const span = Math.max(1, this.levelW - VIEW_W);
    const prog = clamp(camX / span, 0, 1);
    const x = lerp(VIEW_W * 0.88, VIEW_W * 0.6, prog);
    const y = VIEW_H * (this.theme.lightY || 0.5);
    const s = (0.8 + prog * 0.7) * th.lightScale;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const pulse = 1 + Math.sin(this.t * 2.2) * 0.08;
    ctx.globalAlpha = 0.85;
    ctx.drawImage(
      glowTex(th.lightGlow, 128),
      x - 70 * s * pulse,
      y - 70 * s * pulse,
      140 * s * pulse,
      140 * s * pulse,
    );
    ctx.globalAlpha = 1;
    ctx.restore();
    // tháp nhỏ silhouette dưới ánh sáng (màn 1–2; màn 3 lâu đài đã ở layer)
    if (this.name !== "castle") {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = this.name === "forest" ? "#4E8DA8" : "#3A2560";
      const tw = 22 * s,
        thh = 54 * s;
      // thân tháp hơi loe chân
      ctx.beginPath();
      ctx.moveTo(x - tw / 2, y - 4);
      ctx.lineTo(x + tw / 2, y - 4);
      ctx.lineTo(x + tw * 0.62, y + thh);
      ctx.lineTo(x - tw * 0.62, y + thh);
      ctx.closePath();
      ctx.fill();
      // mái chóp có diềm rộng hơn thân
      ctx.beginPath();
      ctx.moveTo(x - tw * 0.78, y - 2);
      ctx.lineTo(x - tw * 0.6, y - 8 * s);
      ctx.lineTo(x, y - 4 - 20 * s);
      ctx.lineTo(x + tw * 0.6, y - 8 * s);
      ctx.lineTo(x + tw * 0.78, y - 2);
      ctx.closePath();
      ctx.fill();
      // ban công nhỏ hai bên
      ctx.fillRect(x - tw * 0.72, y + thh * 0.42, tw * 1.44, 3.5 * s);
      // cửa sổ ấm — nguồn sáng
      ctx.fillStyle = "#FFE9A8";
      ctx.globalAlpha = 0.95;
      const ww = 5 * s;
      ctx.beginPath();
      ctx.arc(x, y + 10 * s, ww, Math.PI, 0);
      ctx.rect(x - ww, y + 10 * s, ww * 2, 8 * s);
      ctx.fill();
      ctx.restore();
    }
  },

  // lớp phủ trước (rays / fog / vignette) — vẽ SAU world
  drawFront(ctx, camX) {
    const th = this.theme;
    if (!th) return;
    const useImg = this.bgImg && this.bgImg.__ready;
    // god rays: bỏ khi tranh nền đã có sẵn tia (tránh chồng tia)
    if (th.rays && this.raysTex && !useImg) {
      // quạt tia mềm pre-render, xoay chậm + thở nhẹ — không còn mép cứng
      const sx = th.sun.x * VIEW_W,
        sy = th.sun.y * VIEW_H;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.75 + Math.sin(this.t * 0.5) * 0.18;
      ctx.translate(sx, sy);
      ctx.rotate(Math.sin(this.t * 0.11) * 0.05);
      const S = this.raysTex.width;
      ctx.drawImage(this.raysTex, -S / 2, -S / 2);
      ctx.restore();
    }
    if (th.fog) {
      ctx.save();
      for (let i = 0; i < 2; i++) {
        const yy = VIEW_H - 90 - i * 60 + Math.sin(this.t * 0.3 + i * 2) * 8;
        const off = (this.t * (8 + i * 5) + camX * 0.1) % (VIEW_W * 2);
        const gr = ctx.createLinearGradient(0, yy, 0, yy + 80);
        gr.addColorStop(0, "rgba(120,110,180,0)");
        gr.addColorStop(0.5, `rgba(120,110,180,${0.08 - i * 0.02})`);
        gr.addColorStop(1, "rgba(120,110,180,0)");
        ctx.fillStyle = gr;
        ctx.fillRect(-off, yy, VIEW_W * 3, 80);
      }
      ctx.restore();
    }
    // ambient particles (screen-space)
    for (const a of this.ambient) {
      ctx.save();
      if (a.kind === "leaves") {
        ctx.translate(a.x, a.y);
        ctx.rotate(Math.sin(a.ph) * 0.8);
        ctx.fillStyle = "rgba(126,190,120,0.75)";
        ctx.beginPath();
        ctx.ellipse(0, 0, a.s * 1.5, a.s * 0.8, 0.4, 0, TAU);
        ctx.fill();
      } else if (a.kind === "motes") {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.4 + Math.sin(a.ph * 2) * 0.25;
        ctx.fillStyle = "#FFE9A8";
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.s, 0, TAU);
        ctx.fill();
      } else {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.5 + Math.sin(a.ph * 3) * 0.3;
        ctx.fillStyle = "#FFB25E";
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.s, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    // vignette nhẹ
    const vg = ctx.createRadialGradient(
      VIEW_W / 2,
      VIEW_H / 2,
      VIEW_H * 0.55,
      VIEW_W / 2,
      VIEW_H / 2,
      VIEW_H * 1.05,
    );
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(
      1,
      this.name === "castle" ? "rgba(4,5,14,0.5)" : "rgba(20,16,40,0.28)",
    );
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  },
};
