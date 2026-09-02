/* particles.js — particle pool + emitter cho mọi hiệu ứng */
"use strict";

const Particles = {
  max: 700,
  list: [],

  reset() {
    this.list.length = 0;
  },

  spawn(o) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({
      x: o.x,
      y: o.y,
      vx: o.vx || 0,
      vy: o.vy || 0,
      life: o.life || 0.6,
      age: 0,
      size: o.size || 4,
      sizeEnd: o.sizeEnd !== undefined ? o.sizeEnd : 0,
      color: o.color || "#ffffff",
      color2: o.color2 || null,
      grav: o.grav !== undefined ? o.grav : 0,
      drag: o.drag !== undefined ? o.drag : 0,
      shape: o.shape || "circle", // circle | spark | heart | star | rect | glow
      rot: o.rot || 0,
      vr: o.vr || 0,
      glow: o.glow || false,
      screen: o.screen || false, // vẽ theo toạ độ màn hình (không theo camera)
    });
  },

  update(dt) {
    const l = this.list;
    for (let i = l.length - 1; i >= 0; i--) {
      const p = l[i];
      p.age += dt;
      if (p.age >= p.life) {
        l.splice(i, 1);
        continue;
      }
      p.vy += p.grav * dt;
      if (p.drag) {
        const d = Math.max(0, 1 - p.drag * dt);
        p.vx *= d;
        p.vy *= d;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
  },

  // gọi 2 lần: pass 'world' (trong camera transform) và pass 'screen'
  draw(ctx, mode = "world") {
    for (const p of this.list) {
      if ((mode === "screen") !== !!p.screen) continue;
      const t = p.age / p.life;
      const size = lerp(p.size, p.sizeEnd, ease.outQuad(t));
      if (size <= 0.3) continue;
      const alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      const col = p.color2 ? mixHex(p.color, p.color2, t) : p.color;
      ctx.save();
      ctx.globalAlpha = alpha;
      if (p.glow) ctx.globalCompositeOperation = "lighter";
      ctx.translate(p.x, p.y);
      if (p.rot) ctx.rotate(p.rot);
      switch (p.shape) {
        case "spark": {
          const len = size * 2.6;
          const ang = Math.atan2(p.vy, p.vx);
          ctx.rotate(ang);
          ctx.strokeStyle = col;
          ctx.lineWidth = Math.max(1, size * 0.45);
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(-len / 2, 0);
          ctx.lineTo(len / 2, 0);
          ctx.stroke();
          break;
        }
        case "heart":
          ctx.fillStyle = col;
          heartPath(ctx, 0, -size * 0.4, size);
          ctx.fill();
          break;
        case "star":
          ctx.fillStyle = col;
          starPath(ctx, 0, 0, size);
          ctx.fill();
          break;
        case "rect":
          ctx.fillStyle = col;
          ctx.fillRect(-size / 2, -size / 2, size, size);
          break;
        case "glow": {
          const tex = glowTex(p.color, 64);
          ctx.drawImage(tex, -size, -size, size * 2, size * 2);
          break;
        }
        default:
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(0, 0, size, 0, TAU);
          ctx.fill();
      }
      ctx.restore();
    }
  },

  // ------- emitters -------
  dustLand(x, y, power = 1) {
    const n = Math.round(6 * power) + 3;
    for (let i = 0; i < n; i++) {
      const a = rand(Math.PI, TAU); // toả ngang
      const sp = rand(40, 140) * power;
      this.spawn({
        x: x + rand(-10, 10),
        y,
        vx: Math.cos(a) * sp * (chance(0.5) ? 1 : -1) * 0.6,
        vy: -Math.abs(Math.sin(a)) * sp * 0.45,
        life: rand(0.3, 0.55),
        size: rand(3, 6),
        sizeEnd: 0,
        color: "#d9cbb2",
        color2: "#b7a688",
        grav: 300,
        drag: 2,
      });
    }
  },

  dustRun(x, y, dir) {
    this.spawn({
      x: x - dir * rand(4, 10),
      y: y + rand(-2, 2),
      vx: -dir * rand(20, 60),
      vy: rand(-40, -10),
      life: rand(0.25, 0.4),
      size: rand(2, 4),
      sizeEnd: 0,
      color: "#e3d7c0",
      grav: 60,
      drag: 3,
    });
  },

  jumpPuff(x, y) {
    for (let i = 0; i < 6; i++) {
      const a = rand(0, TAU);
      this.spawn({
        x,
        y,
        vx: Math.cos(a) * rand(30, 80),
        vy: Math.sin(a) * rand(10, 40),
        life: rand(0.2, 0.4),
        size: rand(3, 5),
        sizeEnd: 0,
        color: "#ffffff",
        drag: 4,
      });
    }
  },

  coinBurst(x, y) {
    for (let i = 0; i < 8; i++) {
      const a = rand(0, TAU),
        sp = rand(60, 190);
      this.spawn({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 60,
        life: rand(0.35, 0.6),
        size: rand(2, 4.5),
        sizeEnd: 0,
        color: "#FFD166",
        color2: "#FFF3C4",
        grav: 500,
        drag: 1.5,
        shape: chance(0.4) ? "star" : "circle",
        glow: true,
        vr: rand(-6, 6),
      });
    }
    this.spawn({
      x,
      y,
      life: 0.3,
      size: 26,
      sizeEnd: 2,
      color: "#FFD166",
      shape: "glow",
      glow: true,
    });
  },

  hitSpark(x, y, color = "#ffffff") {
    for (let i = 0; i < 10; i++) {
      const a = rand(0, TAU),
        sp = rand(120, 320);
      this.spawn({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand(0.15, 0.35),
        size: rand(2, 4),
        sizeEnd: 0,
        color,
        shape: "spark",
        drag: 3,
        glow: true,
      });
    }
    this.spawn({
      x,
      y,
      life: 0.22,
      size: 30,
      sizeEnd: 4,
      color,
      shape: "glow",
      glow: true,
    });
  },

  splat(x, y, color) {
    for (let i = 0; i < 14; i++) {
      const a = rand(0, TAU),
        sp = rand(50, 240);
      this.spawn({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 80,
        life: rand(0.3, 0.7),
        size: rand(2.5, 6),
        sizeEnd: 0,
        color,
        grav: 600,
        drag: 1,
      });
    }
  },

  heal(x, y) {
    for (let i = 0; i < 8; i++) {
      this.spawn({
        x: x + rand(-16, 16),
        y: y + rand(-8, 8),
        vx: rand(-15, 15),
        vy: rand(-90, -40),
        life: rand(0.5, 0.9),
        size: rand(4, 7),
        sizeEnd: 0,
        color: "#FF8FA3",
        color2: "#ffd3dc",
        shape: "heart",
        drag: 1,
      });
    }
  },

  torchFire(x, y) {
    this.spawn({
      x: x + rand(-3, 3),
      y,
      vx: rand(-8, 8),
      vy: rand(-55, -25),
      life: rand(0.4, 0.8),
      size: rand(2.5, 4.5),
      sizeEnd: 0,
      color: "#FFB25E",
      color2: "#ff5e3a",
      glow: true,
      drag: 1,
    });
  },

  dashTrail(x, y) {
    this.spawn({
      x: x + rand(-6, 6),
      y: y + rand(-10, 10),
      vx: rand(-20, 20),
      vy: rand(-20, 20),
      life: rand(0.2, 0.35),
      size: rand(3, 6),
      sizeEnd: 0,
      color: "#9FC1E8",
      color2: "#ffffff",
      glow: true,
      drag: 2,
    });
  },

  firework(x, y, color) {
    const n = 26;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand(-0.1, 0.1),
        sp = rand(140, 260);
      this.spawn({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand(0.6, 1.1),
        size: rand(2, 4),
        sizeEnd: 0,
        color,
        color2: "#ffffff",
        grav: 160,
        drag: 1.2,
        glow: true,
        shape: chance(0.3) ? "star" : "circle",
        vr: rand(-8, 8),
      });
    }
    this.spawn({
      x,
      y,
      life: 0.35,
      size: 60,
      sizeEnd: 6,
      color,
      shape: "glow",
      glow: true,
    });
  },

  hearts(x, y, n = 6) {
    for (let i = 0; i < n; i++) {
      this.spawn({
        x: x + rand(-20, 20),
        y: y + rand(-10, 10),
        vx: rand(-25, 25),
        vy: rand(-110, -50),
        life: rand(0.8, 1.4),
        size: rand(5, 9),
        sizeEnd: 1,
        color: "#FF8FA3",
        color2: "#ffc7d2",
        shape: "heart",
        drag: 0.8,
        vr: rand(-2, 2),
      });
    }
  },

  shockDust(x, y) {
    for (let i = 0; i < 4; i++) {
      this.spawn({
        x: x + rand(-8, 8),
        y: y - rand(0, 6),
        vx: rand(-30, 30),
        vy: rand(-120, -60),
        life: rand(0.25, 0.45),
        size: rand(3, 6),
        sizeEnd: 0,
        color: "#b9a3e0",
        color2: "#6d4fb3",
        grav: 300,
        glow: true,
      });
    }
  },
};
