/* entities.js — nhân vật, quái, boss, công chúa, vật phẩm.
   Quy ước: x = tâm ngang, y = CHÂN (đáy hitbox). Hitbox = (x-w/2, y-h, w, h).
   Vẽ nhận (ctx, a) với a = alpha nội suy giữa prevX/prevY và x/y. */
"use strict";

const iX = (e, a) => lerp(e.prevX !== undefined ? e.prevX : e.x, e.x, a);
const iY = (e, a) => lerp(e.prevY !== undefined ? e.prevY : e.y, e.y, a);

// ========================= PLAYER =========================
class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = 30;
    this.h = 44;
    this.vx = 0;
    this.vy = 0;
    this.face = 1;
    this.onGround = false;
    this.wasGround = false;
    this.coyote = 0;
    this.jbuf = 0;
    this.jumps = 0;
    this.jumpCut = false;
    this.dashT = 0;
    this.dashCd = 0;
    this.canDash = true;
    this.atkT = 0;
    this.atkCd = 0;
    this.hurtT = 0;
    this.hp = 3;
    this.maxHp = 3;
    this.dead = false;
    this.deadT = 0;
    this.sqX = 1;
    this.sqY = 1; // squash & stretch
    this.runPh = 0;
    this.idleT = 0;
    this.stepT = 0;
    this.trail = []; // afterimage khi dash
    this.blink = 0;
    this.prevX = x;
    this.prevY = y;
  }

  get rect() {
    return [this.x - this.w / 2, this.y - this.h, this.w, this.h];
  }
  get atkActive() {
    return this.atkT > 0.08 && this.atkT < 0.2;
  }
  get atkRect() {
    const r = 44;
    return [
      this.x + (this.face > 0 ? this.w / 2 - 8 : -this.w / 2 - r + 8),
      this.y - this.h + 2,
      r,
      this.h + 2,
    ];
  }
  get invul() {
    return this.hurtT > 0 || this.dashT > 0;
  }

  update(dt) {
    if (this.dead) {
      this.deadT += dt;
      return;
    }
    const inp = Game.input;

    // ---- timers
    this.coyote = Math.max(0, this.coyote - dt);
    this.jbuf = Math.max(0, this.jbuf - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.atkT = Math.max(0, this.atkT - dt);
    this.atkCd = Math.max(0, this.atkCd - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.blink -= dt;
    if (this.blink < 0) this.blink = rand(1.5, 4);

    if (Game.consume("jump")) this.jbuf = 0.12;

    // ---- DASH
    if (Game.consume("dash") && this.dashCd <= 0 && this.canDash) {
      this.dashT = 0.16;
      this.dashCd = 0.45;
      this.canDash = this.onGround;
      this.vy = 0;
      AudioSys.sfx("dash");
      Game.addShake(2);
    }
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vx = this.face * 760;
      this.vy = 0;
      this.trail.push({ x: this.x, y: this.y, face: this.face, life: 0.25 });
      Particles.dashTrail(this.x, this.y - this.h / 2);
      Game.moveEntity(this, dt);
      this._anim(dt);
      return;
    }

    // ---- chạy
    const ax = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (ax !== 0) {
      this.face = ax;
      const accel = this.onGround ? 2800 : 1700;
      this.vx += ax * accel * dt;
    } else {
      const fr = this.onGround ? 2600 : 700;
      const s = Math.sign(this.vx);
      this.vx -= s * fr * dt;
      if (Math.sign(this.vx) !== s) this.vx = 0;
    }
    this.vx = clamp(this.vx, -340, 340);

    // ---- trọng lực
    this.vy += 2400 * dt;
    if (this.vy > 1100) this.vy = 1100;

    // ---- nhảy (coyote + buffer + double)
    const canGroundJump = this.onGround || this.coyote > 0;
    if (this.jbuf > 0 && (canGroundJump || this.jumps < 2)) {
      if (canGroundJump) {
        this.vy = -760;
        this.jumps = 1;
        AudioSys.sfx("jump");
      } else {
        this.vy = -660;
        this.jumps = 2;
        AudioSys.sfx("djump");
        Particles.jumpPuff(this.x, this.y);
      }
      this.jbuf = 0;
      this.coyote = 0;
      this.jumpCut = false;
      this.sqX = 0.72;
      this.sqY = 1.24;
    }
    // nhảy cao thấp theo thời gian giữ
    if (!inp.jumpHeld && this.vy < -180 && !this.jumpCut) {
      this.vy *= 0.5;
      this.jumpCut = true;
    }

    // ---- chém
    if (Game.consume("atk") && this.atkCd <= 0) {
      this.atkT = 0.22;
      this.atkCd = 0.3;
      AudioSys.sfx("slash");
    }

    // ---- di chuyển + va chạm
    this.wasGround = this.onGround;
    Game.moveEntity(this, dt);
    if (this.onGround) {
      this.coyote = 0.1;
      this.jumps = 0;
      this.canDash = true;
      if (!this.wasGround) {
        // vừa đáp
        const pow = clamp(this.lastFallV / 900, 0.3, 1.6);
        Particles.dustLand(this.x, this.y, pow);
        this.sqX = 1 + 0.3 * pow;
        this.sqY = 1 - 0.25 * pow;
        if (this.lastFallV > 350) AudioSys.sfx("stomp");
      }
    }
    if (this.vy > 0) this.lastFallV = this.vy;

    // bụi chạy
    this.stepT -= dt;
    if (this.onGround && Math.abs(this.vx) > 160 && this.stepT <= 0) {
      this.stepT = 0.09;
      Particles.dustRun(this.x, this.y, this.face);
    }

    // chới với giữ thăng bằng khi đứng mà tâm đã nhô qua mép (ô dưới tâm là không khí)
    this.teeter = 0;
    if (this.onGround && !this.onPlat && Math.abs(this.vx) < 60) {
      if (Game.tileAt(this.x, this.y + 6) === 0) {
        const supL = Game.solid(Game.tileAt(this.x - 9, this.y + 6));
        this.teeter = supL ? 1 : -1; // nghiêng về phía không có chân đỡ
      }
    }
    this._anim(dt);
  }

  _anim(dt) {
    this.sqX = damp(this.sqX, 1, 12, dt);
    this.sqY = damp(this.sqY, 1, 12, dt);
    this.runPh += Math.abs(this.vx) * dt * 0.05;
    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].life -= dt;
      if (this.trail[i].life <= 0) this.trail.splice(i, 1);
    }
  }

  hurt(dir) {
    if (this.invul || this.dead) return;
    this.hp--;
    Game.onHpChange();
    AudioSys.sfx("hurt");
    Game.addShake(7);
    Game.hitStop(0.09);
    Particles.hitSpark(this.x, this.y - this.h / 2, "#FF8FA3");
    if (this.hp <= 0) {
      this.die();
      return;
    }
    this.hurtT = 1.2;
    this.vx = dir * 300;
    this.vy = -420;
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.deadT = 0;
    AudioSys.sfx("die");
    Game.addShake(10);
    Game.hitStop(0.12);
    Particles.splat(this.x, this.y - this.h / 2, "#9FC1E8");
    Particles.hitSpark(this.x, this.y - this.h / 2, "#ffffff");
    Game.onPlayerDeath();
  }

  bounce() {
    // sau khi đạp quái
    this.vy = -480;
    this.jumps = 1;
    this.canDash = true;
    this.sqX = 0.8;
    this.sqY = 1.18;
  }

  draw(ctx, a) {
    if (this.dead) return;
    if (this.hurtT > 0 && Math.floor(this.hurtT * 14) % 2 === 0) return; // nhấp nháy i-frame
    const x = iX(this, a),
      y = iY(this, a);

    // afterimages
    for (const t of this.trail) {
      ctx.save();
      ctx.globalAlpha = t.life * 1.8;
      ctx.globalCompositeOperation = "lighter";
      ctx.translate(t.x, t.y);
      ctx.scale(t.face, 1);
      ctx.fillStyle = "#9FC1E8";
      roundRectPath(ctx, -12, -40, 24, 34, 8);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -44, 11, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(this.sqX * this.face, this.sqY);
    const run = this.onGround && Math.abs(this.vx) > 40;
    const airUp = !this.onGround && this.vy < -60;
    const airDn = !this.onGround && this.vy > 60;
    const bob = run
      ? Math.sin(this.runPh * 2) * 1.6
      : Math.sin(Game.time * 2.4) * 0.8;
    let lean = run ? 0.1 : 0;
    // chới với ở mép: nghiêng về phía hụt chân + lắc lư tay quạt gió
    if (this.teeter)
      lean +=
        this.face * (this.teeter * 0.12 + Math.sin(Game.time * 13) * 0.055);
    ctx.rotate(lean);

    // --- chân
    const lp = Math.sin(this.runPh * 2),
      rp = Math.sin(this.runPh * 2 + Math.PI);
    ctx.strokeStyle = "#3E4A63";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    const legY = -14;
    if (run) {
      ctx.beginPath();
      ctx.moveTo(-4, legY);
      ctx.lineTo(-4 + lp * 7, -2 - Math.max(0, lp) * 5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(5, legY);
      ctx.lineTo(5 + rp * 7, -2 - Math.max(0, rp) * 5);
      ctx.stroke();
    } else if (airUp || airDn) {
      ctx.beginPath();
      ctx.moveTo(-4, legY);
      ctx.lineTo(-7, airUp ? -6 : -1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(5, legY);
      ctx.lineTo(8, airUp ? -3 : -1);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(-4, legY);
      ctx.lineTo(-5, -1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(5, legY);
      ctx.lineTo(6, -1);
      ctx.stroke();
    }

    // --- áo choàng (cape) bay
    const capeW = 4 + Math.abs(this.vx) * 0.02;
    ctx.fillStyle = "#D64550";
    ctx.beginPath();
    ctx.moveTo(-6, -36 + bob);
    const flow = clamp(-this.vx * this.face * 0.03, -6, 14) + 10;
    const wave = Math.sin(Game.time * 9 + this.runPh) * 3;
    ctx.bezierCurveTo(
      -14 - flow * 0.6,
      -30 + bob + wave,
      -16 - flow,
      -18 + wave,
      -10 - flow,
      -8 + wave * 1.4,
    );
    ctx.lineTo(-8, -14 + bob);
    ctx.closePath();
    ctx.fill();

    // --- thân giáp
    const g = ctx.createLinearGradient(0, -40, 0, -10);
    g.addColorStop(0, "#BFD5EE");
    g.addColorStop(1, "#8FA9CC");
    ctx.fillStyle = g;
    roundRectPath(ctx, -11, -38 + bob, 22, 26, 8);
    ctx.fill();
    ctx.fillStyle = "#5C7096";
    roundRectPath(ctx, -11, -22 + bob, 22, 6, 3);
    ctx.fill(); // đai
    ctx.fillStyle = "#FFD166";
    ctx.fillRect(-2, -21 + bob, 4, 4); // khoá đai

    // --- kiếm + tay
    // bladeAng: 0 = lưỡi chĩa thẳng lên, dương = ngả về trước, âm = ngả ra sau
    const atk = this.atkT > 0;
    let bladeAng = -0.95; // nghỉ: gác chéo lên vai, mũi kiếm nhô rõ sau đầu
    if (!this.onGround) bladeAng = -0.75;
    else if (run) bladeAng = -0.95 - Math.abs(this.vx) * 0.0006; // trễ quán tính
    if (atk) {
      const t = 1 - this.atkT / 0.22;
      bladeAng = lerp(-1.6, 1.9, ease.outCubic(t));
      // vệt chém bám theo hướng mũi kiếm
      if (this.atkActive) {
        const tipA = bladeAng - Math.PI / 2;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.55;
        const gr = ctx.createRadialGradient(9, -26 + bob, 4, 9, -26 + bob, 46);
        gr.addColorStop(0, "rgba(255,255,255,0.9)");
        gr.addColorStop(1, "rgba(159,193,232,0)");
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(9, -26 + bob, 46, tipA - 1.1, tipA + 0.15);
        ctx.lineTo(9, -26 + bob);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.save();
    ctx.translate(9, -26 + bob);
    // cánh tay ngắn nối vai → chuôi
    ctx.strokeStyle = "#5C7096";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-4, -1);
    ctx.lineTo(1, 1);
    ctx.stroke();
    ctx.rotate(bladeAng);
    // cán + núm chuôi
    ctx.fillStyle = "#6B4A2E";
    roundRectPath(ctx, -2.2, 1, 4.4, 6.5, 2);
    ctx.fill();
    ctx.fillStyle = "#FFD166";
    ctx.beginPath();
    ctx.arc(0, 8.6, 2.4, 0, TAU);
    ctx.fill();
    // chắn tay
    roundRectPath(ctx, -7.5, -1.8, 15, 3.6, 1.8);
    ctx.fill();
    // lưỡi thuôn nhọn, viền tối + vạch phản quang → tách khỏi giáp và mọi nền
    const sg = ctx.createLinearGradient(0, -2, 0, -38);
    sg.addColorStop(0, "#D7E5F8");
    sg.addColorStop(1, "#F4F9FF");
    ctx.beginPath();
    ctx.moveTo(-3.25, -2);
    ctx.lineTo(3.25, -2);
    ctx.lineTo(2.6, -29);
    ctx.lineTo(0, -38);
    ctx.lineTo(-2.6, -29);
    ctx.closePath();
    ctx.fillStyle = sg;
    ctx.fill();
    ctx.strokeStyle = "#3E4A63";
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0.9, -4);
    ctx.lineTo(0.3, -32);
    ctx.stroke();
    ctx.restore();

    // --- đầu + mũ giáp
    const hy = -47 + bob;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, hy, 12.5, 0, TAU);
    ctx.fill();
    // khe mặt
    ctx.fillStyle = "#232B3E";
    roundRectPath(ctx, 2, hy - 5, 9.5, 10, 4.5);
    ctx.fill();
    // mắt
    const blink = this.blink < 0.08;
    ctx.fillStyle = "#EAF4FF";
    if (!blink) {
      ctx.beginPath();
      ctx.arc(6.5, hy, 2.1, 0, TAU);
      ctx.fill();
    } else {
      ctx.fillRect(4.5, hy - 0.7, 4.5, 1.6);
    }
    // chóp lông đỏ
    ctx.fillStyle = "#D64550";
    ctx.beginPath();
    ctx.moveTo(-3, hy - 11);
    ctx.quadraticCurveTo(
      -6 - Math.abs(this.vx) * 0.012,
      hy - 22 + wave * 0.5,
      -14,
      hy - 12 + wave * 0.4,
    );
    ctx.quadraticCurveTo(-8, hy - 10, -3, hy - 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// ========================= SLIME =========================
class Slime {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = 34;
    this.h = 24;
    this.vx = chance(0.5) ? 80 : -80;
    this.vy = 0;
    this.onGround = false;
    this.dead = false;
    this.ph = rand(0, TAU);
    this.prevX = x;
    this.prevY = y;
  }
  get rect() {
    return [this.x - this.w / 2, this.y - this.h, this.w, this.h];
  }
  update(dt) {
    this.ph += dt * 8;
    this.vy += 2400 * dt;
    // quay đầu ở mép vực hoặc trước gai
    if (this.onGround) {
      const aheadX = this.x + Math.sign(this.vx) * (this.w / 2 + 6);
      const below = Game.tileAt(aheadX, this.y + 6);
      const at = Game.tileAt(aheadX, this.y - 8);
      if (below === 0 || below === 4 || at === 4) this.vx *= -1;
    }
    Game.moveEntity(this, dt);
    if (this.hitWall) this.vx *= -1;
  }
  kill(byStomp) {
    this.dead = true;
    Particles.splat(this.x, this.y - 10, "#7BD34F");
    Particles.hitSpark(this.x, this.y - 10, "#CFF3A8");
    AudioSys.sfx(byStomp ? "stomp" : "kill");
    Game.addShake(3);
  }
  draw(ctx, a) {
    const x = iX(this, a),
      y = iY(this, a);
    const sq = 1 + Math.sin(this.ph) * 0.09;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1 / sq, sq);
    const g = ctx.createLinearGradient(0, -26, 0, 0);
    g.addColorStop(0, "#9BE86E");
    g.addColorStop(1, "#5CAF35");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-17, 0);
    ctx.quadraticCurveTo(-17, -24, 0, -24);
    ctx.quadraticCurveTo(17, -24, 17, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.ellipse(-6, -17, 5, 3, -0.5, 0, TAU);
    ctx.fill();
    const d = Math.sign(this.vx);
    ctx.fillStyle = "#233018";
    ctx.beginPath();
    ctx.arc(4 * d + 2, -13, 2.6, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(4 * d - 5, -13, 2.6, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#233018";
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(4 * d - 1.5, -8, 3.4, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.restore();
  }
}

// ========================= BAT =========================
class Bat {
  constructor(x, y) {
    this.x0 = x;
    this.y0 = y;
    this.x = x;
    this.y = y;
    this.w = 30;
    this.h = 22;
    this.t = rand(0, TAU);
    this.dead = false;
    this.prevX = x;
    this.prevY = y;
  }
  get rect() {
    return [this.x - this.w / 2, this.y - this.h, this.w, this.h];
  }
  update(dt) {
    this.t += dt;
    this.x = this.x0 + Math.sin(this.t * 1.15) * 150;
    this.y = this.y0 + Math.sin(this.t * 3.1) * 44;
  }
  kill(byStomp) {
    this.dead = true;
    Particles.splat(this.x, this.y - 8, "#8A7BB8");
    AudioSys.sfx(byStomp ? "stomp" : "kill");
    Game.addShake(2);
  }
  draw(ctx, a) {
    const x = iX(this, a),
      y = iY(this, a) - 10;
    const flap = Math.sin(this.t * 14);
    const d = Math.cos(this.t * 0.85) >= 0 ? 1 : -1;
    ctx.save();
    ctx.translate(x, y);
    // cánh
    ctx.fillStyle = "#4A3F73";
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.scale(s, 1);
      ctx.rotate(-flap * 0.55);
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.quadraticCurveTo(16, -12, 26, -4);
      ctx.quadraticCurveTo(18, 2, 12, 2);
      ctx.quadraticCurveTo(9, 5, 4, 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // thân
    ctx.fillStyle = "#5C4F8E";
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, TAU);
    ctx.fill();
    // tai
    ctx.beginPath();
    ctx.moveTo(-6, -6);
    ctx.lineTo(-8, -14);
    ctx.lineTo(-1, -8);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(6, -6);
    ctx.lineTo(8, -14);
    ctx.lineTo(1, -8);
    ctx.closePath();
    ctx.fill();
    // mắt
    ctx.fillStyle = "#FFD166";
    ctx.beginPath();
    ctx.arc(3 * d - 2, -1, 2, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3 * d + 3, -1, 2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

// ========================= MOVING PLATFORM =========================
class MovingPlatform {
  constructor(m) {
    this.axis = m.axis;
    this.min = m.min;
    this.max = m.max;
    this.w = 96;
    this.h = 16;
    this.t = rand(0, TAU);
    this.x = m.x;
    this.y = m.y;
    if (this.axis === "x") this.x = (this.min + this.max) / 2;
    else this.y = (this.min + this.max) / 2;
    this.dx = 0;
    this.dy = 0;
    this.dip = 0; // lún nhún khi bị đáp lên (chỉ hiệu ứng vẽ)
    this.dipV = 0;
    this.prevX = this.x;
    this.prevY = this.y;
  }
  get rect() {
    return [this.x - this.w / 2, this.y - this.h, this.w, this.h];
  }
  get top() {
    return this.y - this.h;
  }
  land(power) {
    this.dipV += 70 + power * 90;
  }
  update(dt) {
    this.t += dt * 2.1;
    const mid = (this.min + this.max) / 2,
      amp = (this.max - this.min) / 2;
    const v = mid + Math.sin(this.t) * amp;
    if (this.axis === "x") {
      this.dx = v - this.x;
      this.dy = 0;
      this.x = v;
    } else {
      this.dy = v - this.y;
      this.dx = 0;
      this.y = v;
    }
    // lò xo lún
    this.dipV += (-this.dip * 220 - this.dipV * 11) * dt;
    this.dip += this.dipV * dt;
  }
  draw(ctx, a) {
    const x = iX(this, a),
      y = iY(this, a) + this.dip;
    const th = Game.level.tileTheme;
    ctx.save();
    ctx.translate(x - this.w / 2, y - this.h);
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, th.stoneTop);
    g.addColorStop(1, th.stoneDark);
    ctx.fillStyle = g;
    roundRectPath(ctx, 0, 0, this.w, this.h, 7);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    roundRectPath(ctx, 3, 2, this.w - 6, 4, 2);
    ctx.fill();
    // rune phát sáng
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = hexA(
      "#7FD9FF",
      0.5 + Math.sin(Game.time * 3 + this.t) * 0.25,
    );
    ctx.beginPath();
    ctx.arc(this.w / 2, this.h / 2 + 1, 3.4, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

// ========================= PICKUPS =========================
class Coin {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.t = rand(0, TAU);
    this.got = false;
  }
  update(dt) {
    this.t += dt * 3;
  }
  draw(ctx) {
    if (this.got) return;
    const y = this.y + Math.sin(this.t) * 3.5;
    const sx = Math.abs(Math.sin(this.t * 1.4)) * 0.75 + 0.25;
    ctx.save();
    ctx.drawImage(glowTex("#FFD166", 64), this.x - 17, y - 17, 34, 34);
    ctx.translate(this.x, y);
    ctx.scale(sx, 1);
    const g = ctx.createLinearGradient(0, -9, 0, 9);
    g.addColorStop(0, "#FFE9A8");
    g.addColorStop(1, "#F5B63F");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#C98A1B";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 6.2, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

class HeartPickup {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.t = rand(0, TAU);
    this.got = false;
  }
  update(dt) {
    this.t += dt * 2.2;
  }
  draw(ctx) {
    if (this.got) return;
    const y = this.y + Math.sin(this.t) * 4;
    const s = 17 + Math.sin(this.t * 2) * 1.5;
    ctx.save();
    ctx.drawImage(glowTex("#FF8FA3", 64), this.x - 22, y - 22, 44, 44);
    const g = ctx.createLinearGradient(this.x, y - 10, this.x, y + 10);
    g.addColorStop(0, "#FFB3C1");
    g.addColorStop(1, "#F25C74");
    ctx.fillStyle = g;
    heartPath(ctx, this.x, y - s * 0.42, s);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.ellipse(this.x - 4, y - 4.5, 3, 2, -0.6, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

// ========================= CHECKPOINT =========================
class Checkpoint {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.on = false;
    this.t = 0;
  }
  update(dt) {
    if (this.on) this.t += dt;
  }
  activate() {
    if (this.on) return;
    this.on = true;
    AudioSys.sfx("check");
    Particles.hitSpark(this.x, this.y - 44, "#FFD166");
    Particles.hearts(this.x, this.y - 40, 3);
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = "#8A93A8";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -52);
    ctx.stroke();
    ctx.fillStyle = "#B9C2D6";
    ctx.beginPath();
    ctx.arc(0, -54, 3.4, 0, TAU);
    ctx.fill();
    const raise = this.on ? Math.min(1, this.t * 3) : 0;
    const fy = -50 + (1 - raise) * 14;
    const wav = Math.sin(Game.time * 5) * 3;
    ctx.fillStyle = this.on ? "#FFD166" : "#5E6880";
    ctx.beginPath();
    ctx.moveTo(2, fy);
    ctx.quadraticCurveTo(14, fy + 2 + wav * 0.4, 24, fy + 4 + wav);
    ctx.lineTo(24, fy + 12 + wav);
    ctx.quadraticCurveTo(14, fy + 10 + wav * 0.4, 2, fy + 14);
    ctx.closePath();
    ctx.fill();
    if (this.on) {
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(glowTex("#FFD166", 64), -16, fy - 8, 32, 32);
    }
    ctx.restore();
  }
}

// ========================= TORCH =========================
class Torch {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.t = rand(0, TAU);
    this.emitT = 0;
  }
  update(dt) {
    this.t += dt;
    this.emitT -= dt;
    if (this.emitT <= 0) {
      this.emitT = 0.12;
      Particles.torchFire(this.x, this.y - 40);
    }
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = "#6B4A2E";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -34);
    ctx.stroke();
    ctx.fillStyle = "#4A3320";
    roundRectPath(ctx, -5, -40, 10, 8, 3);
    ctx.fill();
    const fl = Math.sin(this.t * 11) * 1.6 + Math.sin(this.t * 23) * 0.8;
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(glowTex("#FFB25E", 96), -38, -78 + fl, 76, 76);
    ctx.fillStyle = "#FFB25E";
    ctx.beginPath();
    ctx.moveTo(-5, -40);
    ctx.quadraticCurveTo(-6 + fl, -52, 0 + fl * 0.6, -58 - Math.abs(fl));
    ctx.quadraticCurveTo(6 + fl, -52, 5, -40);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#FFE9A8";
    ctx.beginPath();
    ctx.moveTo(-2.5, -41);
    ctx.quadraticCurveTo(-2 + fl * 0.5, -48, 0, -51 - Math.abs(fl) * 0.5);
    ctx.quadraticCurveTo(2 + fl * 0.5, -48, 2.5, -41);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// ========================= EXIT DOOR =========================
class ExitDoor {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.t = 0;
  }
  get rect() {
    return [this.x - 24, this.y - 76, 48, 76];
  }
  update(dt) {
    this.t += dt;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    // khung đá
    ctx.fillStyle = "#5A5E75";
    roundRectPath(ctx, -30, -84, 60, 84, { tl: 26, tr: 26, br: 4, bl: 4 });
    ctx.fill();
    ctx.fillStyle = "#767B96";
    roundRectPath(ctx, -25, -79, 50, 79, { tl: 22, tr: 22, br: 3, bl: 3 });
    ctx.fill();
    // cổng phát sáng
    const pulse = 0.75 + Math.sin(this.t * 2.6) * 0.25;
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(glowTex("#7FD9FF", 128), -58, -108, 116, 116);
    ctx.globalCompositeOperation = "source-over";
    const g = ctx.createLinearGradient(0, -74, 0, 0);
    g.addColorStop(0, "#BFF0FF");
    g.addColorStop(1, "#3FA8D9");
    ctx.fillStyle = g;
    roundRectPath(ctx, -19, -73, 38, 73, { tl: 18, tr: 18, br: 2, bl: 2 });
    ctx.fill();
    // xoáy
    ctx.strokeStyle = `rgba(255,255,255,${0.5 * pulse})`;
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(
        0,
        -32 - i * 6,
        8 + i * 5,
        this.t * (1.5 + i * 0.4),
        this.t * (1.5 + i * 0.4) + 3.6,
      );
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ========================= SHOCKWAVE (boss) =========================
class Shockwave {
  constructor(x, y, dir) {
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.w = 26;
    this.h = 30;
    this.dead = false;
    this.t = 0;
    this.prevX = x;
    this.prevY = y;
  }
  get rect() {
    return [this.x - this.w / 2, this.y - this.h, this.w, this.h];
  }
  update(dt) {
    this.t += dt;
    this.x += this.dir * 430 * dt;
    Particles.shockDust(this.x, this.y);
    const ahead = Game.tileAt(this.x + this.dir * 16, this.y - 8);
    if (ahead === 1 || ahead === 2) this.dead = true;
    if (this.t > 2.4) this.dead = true;
    // rơi theo mặt đất
    const below = Game.tileAt(this.x, this.y + 4);
    if (below === 0) this.y += 300 * dt;
  }
  draw(ctx, a) {
    const x = iX(this, a),
      y = iY(this, a);
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(glowTex("#B18CFF", 64), -26, -34, 52, 52);
    ctx.fillStyle = "#C9AAFF";
    const h = 24 + Math.sin(this.t * 30) * 4;
    ctx.beginPath();
    ctx.moveTo(-12 * this.dir, 0);
    ctx.quadraticCurveTo(0, -h, 10 * this.dir, -h * 0.55);
    ctx.quadraticCurveTo(4 * this.dir, -h * 0.2, 12 * this.dir, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// ========================= BOSS — HẮC KỴ SĨ =========================
class Boss {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = 60;
    this.h = 82;
    this.vx = 0;
    this.vy = 0;
    this.hp = 10;
    this.maxHp = 10;
    this.state = "wait";
    this.st = 0;
    this.face = -1;
    this.onGround = true;
    this.flash = 0;
    this.dead = false;
    this.slamCount = 0;
    this.arenaL = 0;
    this.arenaR = 0; // set khi kích hoạt
    this.prevX = x;
    this.prevY = y;
  }
  get rect() {
    return [this.x - this.w / 2, this.y - this.h, this.w, this.h];
  }
  get vulnerable() {
    return this.state === "stun";
  }

  activate(arenaL, arenaR) {
    if (this.state !== "wait") return;
    this.arenaL = arenaL;
    this.arenaR = arenaR;
    this.state = "roar";
    this.st = 0;
    AudioSys.sfx("boss_roar");
    Game.addShake(9);
  }

  hitByPlayer() {
    if (this.dead) return false;
    if (!this.vulnerable) {
      AudioSys.sfx("clang");
      Particles.hitSpark(this.x - this.face * 30, this.y - 50, "#B9C2D6");
      return false;
    }
    this.hp--;
    this.flash = 0.15;
    AudioSys.sfx("boss_hit");
    Game.addShake(6);
    Game.hitStop(0.1);
    Particles.hitSpark(this.x, this.y - 50, "#B18CFF");
    Game.onBossHp();
    if (this.hp <= 0) {
      this.state = "dying";
      this.st = 0;
      AudioSys.sfx("boss_die");
      Game.onBossDying();
    } else {
      // tối đa 2 nhát mỗi lần choáng — sau đó boss vùng dậy ngay
      this._stunHits = (this._stunHits || 0) + 1;
      if (this._stunHits >= 2) {
        this.state = "idle";
        this.st = 0;
        AudioSys.sfx("boss_roar");
        Game.addShake(5);
      }
    }
    return true;
  }

  update(dt) {
    this.st += dt;
    this.flash = Math.max(0, this.flash - dt);
    const p = Game.player;
    const S = this.state;

    if (S === "wait") {
      return; // đứng thở chờ kích hoạt
    }
    if (S === "roar") {
      if (this.st > 1.1) {
        this.state = "idle";
        this.st = 0;
      }
      return;
    }
    if (S === "idle") {
      this.face = p.x < this.x ? -1 : 1;
      if (this.st > 0.65) {
        this.st = 0;
        const useSlam = this.hp <= 8 && this.slamCount % 2 === 0;
        this.slamCount++;
        if (useSlam) {
          this.state = "jump";
          this.vy = -940;
          AudioSys.sfx("boss_roar");
        } else this.state = "tele";
      }
    } else if (S === "tele") {
      this.face = p.x < this.x ? -1 : 1;
      if (this.st > 0.42) {
        this.state = "charge";
        this.st = 0;
        AudioSys.sfx("dash");
      }
    } else if (S === "charge") {
      this.vx = this.face * 690;
      this.x += this.vx * dt;
      if (chance(0.4))
        Particles.dustRun(this.x - this.face * 24, this.y, this.face);
      const hitL = this.x - this.w / 2 <= this.arenaL,
        hitR = this.x + this.w / 2 >= this.arenaR;
      if (hitL || hitR) {
        this.x = clamp(
          this.x,
          this.arenaL + this.w / 2,
          this.arenaR - this.w / 2,
        );
        this.state = "stun";
        this.st = 0;
        this.vx = 0;
        this._stunHits = 0;
        AudioSys.sfx("slam");
        Game.addShake(11);
        Game.hitStop(0.05);
        Particles.dustLand(this.x, this.y, 1.6);
        Particles.hitSpark(this.x + this.face * 30, this.y - 50, "#FFD166");
        // dưới nửa máu: cú tông tường dội một sóng ngược về phía người chơi
        if (this.hp <= 4)
          Game.shocks.push(
            new Shockwave(this.x - this.face * 44, this.y, -this.face),
          );
      }
    } else if (S === "jump") {
      this.vy += 2000 * dt;
      this.y += this.vy * dt;
      // bám theo player lúc còn bay lên; nửa sau cú rơi khoá điểm đáp
      // để người chơi đọc được và thoát kịp (340px/s > 200px/s)
      if (this.vy < 150) this.x += clamp(p.x - this.x, -200 * dt, 200 * dt);
      this.x = clamp(
        this.x,
        this.arenaL + this.w / 2,
        this.arenaR - this.w / 2,
      );
      if (this.vy > 0 && this.y >= Game.bossFloorY) {
        this.y = Game.bossFloorY;
        this.state = "land";
        this.st = 0;
        AudioSys.sfx("slam");
        Game.addShake(14);
        Game.hitStop(0.08);
        Particles.dustLand(this.x, this.y, 2.2);
        Game.spawnShockwaves(this.x, this.y);
      }
    } else if (S === "land") {
      if (this.st > 0.7) {
        this.state = "idle";
        this.st = 0;
      }
    } else if (S === "stun") {
      if (this.st > 1.9) {
        this.state = "idle";
        this.st = 0;
      }
    } else if (S === "dying") {
      if (chance(0.5)) {
        Particles.hitSpark(
          this.x + rand(-30, 30),
          this.y - rand(10, 80),
          pick(["#B18CFF", "#FFD166", "#ffffff"]),
        );
      }
      if (this.st > 2.2 && !this.dead) {
        this.dead = true;
        Particles.firework(this.x, this.y - 50, "#B18CFF");
        Particles.firework(this.x - 30, this.y - 80, "#FFD166");
        Particles.firework(this.x + 30, this.y - 60, "#FF8FA3");
        Game.addShake(12);
        Game.onBossDefeated();
      }
    }
  }

  draw(ctx, a) {
    if (this.dead) return;
    const x = iX(this, a),
      y = iY(this, a);
    const S = this.state;
    ctx.save();
    ctx.translate(x, y);
    if (S === "dying") {
      const t = this.st / 2.2;
      ctx.globalAlpha = 1 - t * 0.8;
      ctx.translate(rand(-3, 3) * t * 2, 0);
    }
    ctx.scale(this.face < 0 ? 1 : -1, 1); // mặc định nhìn trái
    const breathe = Math.sin(Game.time * 2.2) * 2;
    const stunTilt = S === "stun" ? Math.sin(this.st * 3) * 0.12 + 0.18 : 0;
    const crouch = S === "tele" ? (this.st / 0.55) * 10 : 0;
    ctx.rotate(-stunTilt);

    // hào quang đe doạ
    ctx.globalCompositeOperation = "lighter";
    const aura = S === "tele" ? 1.6 : 1;
    ctx.globalAlpha *= 0.5;
    ctx.drawImage(
      glowTex("#6D4FB3", 128),
      -70 * aura,
      -130 * aura + 20,
      140 * aura,
      140 * aura,
    );
    ctx.globalAlpha = S === "dying" ? 1 - this.st / 2.6 : 1;
    ctx.globalCompositeOperation = "source-over";

    // chân
    ctx.strokeStyle = "#241F3D";
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-12, -22);
    ctx.lineTo(-15, -2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(12, -22);
    ctx.lineTo(15, -2);
    ctx.stroke();

    // áo choàng rách
    ctx.fillStyle = "#1B1733";
    ctx.beginPath();
    ctx.moveTo(10, -66 + breathe);
    ctx.quadraticCurveTo(34, -46, 30 + Math.sin(Game.time * 3) * 4, -6);
    ctx.lineTo(22, -10);
    ctx.lineTo(20, -2);
    ctx.lineTo(14, -12);
    ctx.closePath();
    ctx.fill();

    // thân giáp lớn
    const g = ctx.createLinearGradient(0, -76, 0, -10);
    g.addColorStop(0, "#443B6E");
    g.addColorStop(1, "#262040");
    ctx.fillStyle = this.flash > 0 ? "#EDE6FF" : g;
    roundRectPath(
      ctx,
      -24,
      -74 + breathe + crouch * 0.4,
      48,
      52 - crouch * 0.3,
      14,
    );
    ctx.fill();
    // vai gai
    ctx.fillStyle = this.flash > 0 ? "#EDE6FF" : "#332B57";
    ctx.beginPath();
    ctx.moveTo(-24, -70 + breathe);
    ctx.lineTo(-38, -78 + breathe);
    ctx.lineTo(-26, -56 + breathe);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(24, -70 + breathe);
    ctx.lineTo(38, -78 + breathe);
    ctx.lineTo(26, -56 + breathe);
    ctx.closePath();
    ctx.fill();

    // vết nứt phát sáng khi yếu máu
    if (this.hp <= 3) {
      ctx.strokeStyle = hexA("#B18CFF", 0.85);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, -66 + breathe);
      ctx.lineTo(-2, -56 + breathe);
      ctx.lineTo(-10, -46 + breathe);
      ctx.stroke();
      if (this.hp <= 1) {
        ctx.beginPath();
        ctx.moveTo(10, -68 + breathe);
        ctx.lineTo(6, -58 + breathe);
        ctx.lineTo(14, -50 + breathe);
        ctx.stroke();
      }
    }

    // đầu — mũ trùm sừng
    const hy = -86 + breathe + crouch;
    ctx.fillStyle = this.flash > 0 ? "#EDE6FF" : "#332B57";
    roundRectPath(ctx, -16, hy, 32, 24, 10);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-14, hy + 4);
    ctx.lineTo(-28, hy - 12);
    ctx.lineTo(-10, hy - 2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, hy + 4);
    ctx.lineTo(28, hy - 12);
    ctx.lineTo(10, hy - 2);
    ctx.closePath();
    ctx.fill();
    // mắt phát sáng
    ctx.globalCompositeOperation = "lighter";
    const eyeC = S === "tele" ? "#FF5E7A" : "#B18CFF";
    ctx.drawImage(glowTex(eyeC, 32), -14, hy + 6, 12, 12);
    ctx.drawImage(glowTex(eyeC, 32), 2, hy + 6, 12, 12);
    ctx.fillStyle = "#fff";
    ctx.fillRect(-10.5, hy + 10, 4, 2.4);
    ctx.fillRect(5.5, hy + 10, 4, 2.4);
    ctx.globalCompositeOperation = "source-over";

    // đại kiếm
    ctx.save();
    ctx.translate(-24, -34 + breathe);
    const swing =
      S === "charge"
        ? -0.5
        : S === "stun"
          ? 1.1
          : 0.35 + Math.sin(Game.time * 2) * 0.05;
    ctx.rotate(swing);
    const sg = ctx.createLinearGradient(0, 0, 0, -58);
    sg.addColorStop(0, "#8F86BF");
    sg.addColorStop(1, "#4F4680");
    ctx.fillStyle = sg;
    roundRectPath(ctx, -5, -58, 10, 52, 4);
    ctx.fill();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = hexA("#B18CFF", 0.7);
    roundRectPath(ctx, -1.5, -56, 3, 48, 1.5);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#241F3D";
    roundRectPath(ctx, -10, -8, 20, 6, 3);
    ctx.fill();
    ctx.restore();

    // sao choáng
    if (S === "stun") {
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 3; i++) {
        const ang = this.st * 4 + i * (TAU / 3);
        ctx.fillStyle = "#FFD166";
        starPath(ctx, Math.cos(ang) * 26, hy - 14 + Math.sin(ang) * 7, 5);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

// ========================= CÔNG CHÚA CLAUDE =========================
class Princess {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.t = rand(0, TAU);
    this.mode = "tower"; // tower | descend | run | reunited
    this.tx = x;
    this.ty = y;
    this.face = -1;
    this.sparkT = 0;
    this.prevX = x;
    this.prevY = y;
  }
  update(dt) {
    this.t += dt;
    this.sparkT -= dt;
    if (this.mode === "tower" && this.sparkT <= 0) {
      this.sparkT = 1.4;
      Particles.spawn({
        x: this.x + rand(-14, 14),
        y: this.y - rand(30, 60),
        vx: rand(-8, 8),
        vy: rand(-18, -8),
        life: 0.9,
        size: 3,
        sizeEnd: 0,
        color: "#FFE9A8",
        glow: true,
        shape: "star",
      });
    }
    if (this.mode === "descend") {
      this.y = damp(this.y, this.ty, 2.2, dt);
      this.x = damp(this.x, this.tx, 2.2, dt);
      Particles.spawn({
        x: this.x + rand(-10, 10),
        y: this.y - rand(0, 40),
        vx: 0,
        vy: rand(10, 30),
        life: 0.7,
        size: 2.5,
        sizeEnd: 0,
        color: "#FFE9A8",
        glow: true,
      });
      if (Math.abs(this.y - this.ty) < 4) {
        this.mode = "run";
      }
    } else if (this.mode === "run") {
      const dx = this.tx - this.x;
      this.face = Math.sign(dx) || this.face;
      if (Math.abs(dx) > 26) this.x += Math.sign(dx) * 150 * dt;
      else {
        this.mode = "reunited";
        Particles.hearts(this.x, this.y - 60, 8);
        AudioSys.sfx("heart");
      }
    }
  }
  draw(ctx, a) {
    const x = iX(this, a),
      y = iY(this, a);
    const bob = Math.sin(this.t * 2.4) * 1.6;
    const run = this.mode === "run";
    const runPh = this.t * 11;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(this.face < 0 ? 1 : -1, 1);
    // hào quang dịu
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.45 + Math.sin(this.t * 2) * 0.1;
    ctx.drawImage(glowTex("#FFE9A8", 128), -55, -115, 110, 110);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    // váy
    const sway = Math.sin(this.t * 2.1) * 2.5 + (run ? Math.sin(runPh) * 2 : 0);
    const g = ctx.createLinearGradient(0, -46, 0, 0);
    g.addColorStop(0, "#FFAABB");
    g.addColorStop(1, "#F2607E");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-6, -44 + bob);
    ctx.quadraticCurveTo(-20 - sway, -8, -16 - sway, 0);
    ctx.lineTo(16 + sway * 0.6, 0);
    ctx.quadraticCurveTo(19 + sway * 0.6, -8, 6, -44 + bob);
    ctx.closePath();
    ctx.fill();
    // chân khi chạy
    if (run) {
      ctx.strokeStyle = "#E8B08E";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-4, -6);
      ctx.lineTo(-4 + Math.sin(runPh) * 7, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(5, -6);
      ctx.lineTo(5 - Math.sin(runPh) * 7, 0);
      ctx.stroke();
    }
    // thân
    ctx.fillStyle = "#FFC9D4";
    roundRectPath(ctx, -8, -52 + bob, 16, 16, 6);
    ctx.fill();
    // tay vẫy (mode tower) / đưa trước (run)
    ctx.strokeStyle = "#F2D4BC";
    ctx.lineWidth = 4.6;
    ctx.lineCap = "round";
    if (this.mode === "tower") {
      const wv = Math.sin(this.t * 6) * 0.7;
      const waving = this.t % 4 < 2;
      ctx.beginPath();
      ctx.moveTo(7, -46 + bob);
      if (waving) ctx.lineTo(14, -58 + bob - wv * 5);
      else ctx.lineTo(12, -40 + bob);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(7, -46 + bob);
      ctx.lineTo(14, -42 + bob);
      ctx.stroke();
    }
    // đầu
    const hy = -62 + bob;
    ctx.fillStyle = "#FBE0C8";
    ctx.beginPath();
    ctx.arc(0, hy, 11, 0, TAU);
    ctx.fill();
    // tóc vàng dài
    ctx.fillStyle = "#F7C948";
    ctx.beginPath();
    ctx.arc(0, hy - 2, 11.5, Math.PI * 0.95, Math.PI * 2.05);
    ctx.quadraticCurveTo(15, hy + 10, 12 + Math.sin(this.t * 2.4) * 2, hy + 34);
    ctx.lineTo(6, hy + 30);
    ctx.quadraticCurveTo(9, hy + 12, 5, hy + 2);
    ctx.closePath();
    ctx.fill();
    // mắt + má hồng + miệng
    ctx.fillStyle = "#3A2E2E";
    ctx.beginPath();
    ctx.arc(-4.5, hy + 1, 1.8, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3.5, hy + 1, 1.8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(255,120,140,0.45)";
    ctx.beginPath();
    ctx.arc(-6.5, hy + 4.5, 2.2, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(5.5, hy + 4.5, 2.2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#B4626D";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(-0.5, hy + 4.5, 2.6, 0.2, Math.PI - 0.2);
    ctx.stroke();
    // vương miện
    ctx.fillStyle = "#FFD166";
    ctx.beginPath();
    ctx.moveTo(-7, hy - 9);
    ctx.lineTo(-7, hy - 15);
    ctx.lineTo(-3.5, hy - 11);
    ctx.lineTo(0, hy - 16);
    ctx.lineTo(3.5, hy - 11);
    ctx.lineTo(7, hy - 15);
    ctx.lineTo(7, hy - 9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#FF8FA3";
    ctx.beginPath();
    ctx.arc(0, hy - 12, 1.6, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}
