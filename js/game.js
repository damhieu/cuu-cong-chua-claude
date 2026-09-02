/* game.js — vòng lặp fixed-timestep + nội suy, va chạm tile, camera, state machine,
   tương tác, boss arena, cutscene, HUD, UI glue. */
"use strict";

const STEP = 1 / 60;

const Game = {
  canvas: null,
  ctx: null,
  dpr: 1,
  scale: 1,
  state: "title",
  paused: false,
  time: 0,
  timeScale: 1,
  hitStopT: 0,
  acc: 0,
  last: 0,
  fps: 60,
  _fpsAcc: 0,
  _fpsN: 0,

  level: null,
  levelIdx: 0,
  player: null,
  slimes: [],
  bats: [],
  platforms: [],
  shocks: [],
  coins: [],
  hearts: [],
  checks: [],
  torches: [],
  door: null,
  boss: null,
  princess: null,
  gate: null,
  bossActive: false,
  bossDefeated: false,
  bossFloorY: 0,
  barrierX: 0,
  barrierA: 0,

  cam: { x: 0, y: 0, prevX: 0, prevY: 0, look: 0 },
  trauma: 0,

  input: { left: false, right: false, jumpHeld: false },
  _pressed: {},

  coinCount: 0,
  deaths: 0,
  runTime: 0,
  timerOn: false,
  lastCheck: null,
  banner: 0,
  bannerText: ["", ""],
  fade: 1,
  fadeDir: -1, // 1=đen dần, -1=sáng dần
  clearT: -1,
  cutT: -1,
  deathT: -1,
  hudCoinBump: 0,
  hudHpPulse: 0,
  attractT: 0,

  // ================= BOOT =================
  boot() {
    this.canvas = document.getElementById("game");
    this.ctx = this.canvas.getContext("2d");
    this.isTouch = false;
    if (matchMedia("(pointer: coarse)").matches) this._enableTouch();
    else
      addEventListener("touchstart", () => this._enableTouch(), {
        once: true,
        passive: true,
      });
    this.resize();
    addEventListener("resize", () => this.resize());
    addEventListener("orientationchange", () =>
      setTimeout(() => this.resize(), 60),
    );
    this._bindInput();
    this._bindUI();
    this._bindTouch();
    this._bindFullscreenButton();
    const vl = document.getElementById("version-line");
    if (vl)
      vl.textContent = "v" + GAME_INFO.version + " — build " + GAME_INFO.built;
    console.log(
      "Cứu Công Chúa Claude v" +
        GAME_INFO.version +
        " (build " +
        GAME_INFO.built +
        ")",
    );
    this.loadLevel(0, true);
    this.showScreen("title");
    AudioSys.music("title");
    this.last = performance.now();
    requestAnimationFrame((t) => this._frame(t));
  },

  _enableTouch() {
    this.isTouch = true;
    document.body.classList.add("touch");
    this.resize();
  },

  resize() {
    const aw = innerWidth / VIEW_W,
      ah = innerHeight / VIEW_H;
    const s = Math.min(aw, ah);
    const cssW = Math.floor(VIEW_W * s),
      cssH = Math.floor(VIEW_H * s);
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.style.width = cssW + "px";
    this.canvas.style.height = cssH + "px";
    this.canvas.width = Math.floor(cssW * this.dpr);
    this.canvas.height = Math.floor(cssH * this.dpr);
    this.scale = this.canvas.width / VIEW_W;
    // dọc trên máy cảm ứng → mời xoay ngang, tự tạm dừng
    const portrait = this.isTouch && innerHeight > innerWidth;
    document.body.classList.toggle("portrait", portrait);
    if (portrait && this.state === "play" && !this.paused) this.togglePause();
  },

  // ================= INPUT =================
  _bindInput() {
    const down = (e) => {
      if (e.repeat) {
        if (["ArrowUp", "ArrowDown", "Space"].includes(e.code))
          e.preventDefault();
        return;
      }
      AudioSys.ensure();
      switch (e.code) {
        case "ArrowLeft":
        case "KeyA":
          this.input.left = true;
          break;
        case "ArrowRight":
        case "KeyD":
          this.input.right = true;
          break;
        case "ArrowUp":
        case "KeyW":
        case "Space":
          this.input.jumpHeld = true;
          this._pressed.jump = true;
          e.preventDefault();
          break;
        case "ShiftLeft":
        case "ShiftRight":
        case "KeyX":
          this._pressed.dash = true;
          break;
        case "KeyZ":
        case "KeyJ":
        case "KeyK":
          this._pressed.atk = true;
          break;
        case "KeyM":
          AudioSys.toggleMute();
          this._updateMuteLabel();
          break;
        case "KeyP":
        case "Escape":
          this.togglePause();
          break;
        case "Enter":
          if (this.state === "title") this.startGame();
          else if (this.state === "victory") this.restartAll();
          else if (this.state === "cutscene" && this.cutT > 1)
            this._cutsceneSkip = true;
          break;
      }
      if (["ArrowLeft", "ArrowRight", "ArrowDown"].includes(e.code))
        e.preventDefault();
    };
    const up = (e) => {
      switch (e.code) {
        case "ArrowLeft":
        case "KeyA":
          this.input.left = false;
          break;
        case "ArrowRight":
        case "KeyD":
          this.input.right = false;
          break;
        case "ArrowUp":
        case "KeyW":
        case "Space":
          this.input.jumpHeld = false;
          break;
      }
    };
    addEventListener("keydown", down);
    addEventListener("keyup", up);
  },

  consume(name) {
    const v = this._pressed[name];
    this._pressed[name] = false;
    return !!v;
  },

  _bindUI() {
    const $ = (id) => document.getElementById(id);
    $("btn-start").onclick = () => {
      AudioSys.ensure();
      AudioSys.sfx("ui");
      this.startGame();
    };
    $("btn-howto").onclick = () => {
      AudioSys.ensure();
      AudioSys.sfx("ui");
      this.showScreen("howto");
    };
    $("btn-back").onclick = () => {
      AudioSys.sfx("ui");
      this.showScreen("title");
    };
    $("btn-resume").onclick = () => {
      AudioSys.sfx("ui");
      this.togglePause();
    };
    $("btn-quit").onclick = () => {
      AudioSys.sfx("ui");
      this.quitToTitle();
    };
    $("btn-again").onclick = () => {
      AudioSys.sfx("ui");
      this.restartAll();
    };
    $("btn-mute").onclick = () => {
      AudioSys.ensure();
      AudioSys.toggleMute();
      this._updateMuteLabel();
      AudioSys.sfx("ui");
    };
    // chạm màn hình để bỏ qua cutscene (mọi thiết bị)
    document.getElementById("stage").addEventListener("pointerdown", () => {
      AudioSys.ensure();
      if (this.state === "cutscene" && this.cutT > 1) this._cutsceneSkip = true;
    });
  },

  _updateMuteLabel() {
    const b = document.getElementById("btn-mute");
    if (b)
      b.textContent = AudioSys.muted ? "🔇 Âm thanh: tắt" : "🔊 Âm thanh: bật";
  },

  // ---- điều khiển cảm ứng: multi-touch qua Pointer Events ----
  _bindTouch() {
    const el = (id) => document.getElementById(id);
    const ui = el("touch-ui");
    if (!ui) return;
    ui.addEventListener("contextmenu", (e) => e.preventDefault());

    // pad trái: container nhận pointer, nửa trái/phải quyết định hướng;
    // ngón đặt sau cùng thắng, nhấc ra thì ngón còn lại tiếp quản
    const pad = el("tpad");
    const pads = new Map(); // pointerId -> 'left' | 'right'
    const sideOf = (e) => {
      const r = pad.getBoundingClientRect();
      return e.clientX < r.left + r.width / 2 ? "left" : "right";
    };
    const updPad = () => {
      const arr = [...pads.values()];
      const last = arr.length ? arr[arr.length - 1] : null;
      this.input.left = last === "left";
      this.input.right = last === "right";
      el("tbtn-left").classList.toggle("pressed", this.input.left);
      el("tbtn-right").classList.toggle("pressed", this.input.right);
    };
    pad.addEventListener("pointerdown", (e) => {
      AudioSys.ensure();
      try {
        pad.setPointerCapture(e.pointerId);
      } catch (err) {
        /* pointer không còn active — bỏ qua */
      }
      pads.delete(e.pointerId);
      pads.set(e.pointerId, sideOf(e));
      updPad();
      e.preventDefault();
    });
    pad.addEventListener("pointermove", (e) => {
      if (!pads.has(e.pointerId)) return;
      const s = sideOf(e);
      if (pads.get(e.pointerId) !== s) {
        pads.delete(e.pointerId);
        pads.set(e.pointerId, s);
        updPad();
      }
    });
    const padEnd = (e) => {
      if (pads.delete(e.pointerId)) updPad();
    };
    pad.addEventListener("pointerup", padEnd);
    pad.addEventListener("pointercancel", padEnd);

    // nút hành động
    const bindBtn = (id, down, up) => {
      const b = el(id);
      const ids = new Set();
      b.addEventListener("pointerdown", (e) => {
        AudioSys.ensure();
        try {
          b.setPointerCapture(e.pointerId);
        } catch (err) {
          /* pointer không còn active — bỏ qua */
        }
        ids.add(e.pointerId);
        b.classList.add("pressed");
        down();
        e.preventDefault();
      });
      const end = (e) => {
        if (!ids.delete(e.pointerId)) return;
        if (!ids.size) {
          b.classList.remove("pressed");
          if (up) up();
        }
      };
      b.addEventListener("pointerup", end);
      b.addEventListener("pointercancel", end);
    };
    bindBtn(
      "tbtn-jump",
      () => {
        this.input.jumpHeld = true;
        this._pressed.jump = true;
      },
      () => {
        this.input.jumpHeld = false;
      },
    );
    bindBtn("tbtn-atk", () => {
      this._pressed.atk = true;
    });
    bindBtn("tbtn-dash", () => {
      this._pressed.dash = true;
    });
    bindBtn("tbtn-pause", () => {
      this.togglePause();
    });
  },

  showScreen(name) {
    for (const el of document.querySelectorAll(".screen"))
      el.classList.remove("show");
    if (name) document.getElementById("screen-" + name).classList.add("show");
    document.body.classList.toggle("menu-open", !!name);
  },

  // ================= LEVEL =================
  loadLevel(idx, attract = false) {
    this.levelIdx = idx;
    const L = parseLevel(idx);
    this.level = L;
    Background.build(L.theme, L.widthPx, L.heightPx);
    Particles.reset();
    this.coins = L.coins.map((c) => new Coin(c.x, c.y));
    this.hearts = L.hearts.map((c) => new HeartPickup(c.x, c.y));
    this.checks = L.checks.map((c) => new Checkpoint(c.x, c.y));
    this.torches = L.torches.map((c) => new Torch(c.x, c.y));
    this.door = L.door ? new ExitDoor(L.door.x, L.door.y) : null;
    this.gate = L.gate;
    this.princess = L.princess
      ? new Princess(L.princess.x, L.princess.y)
      : null;
    this.bossDefeated = false;
    this.bossActive = false;
    this.barrierA = 0;
    this.lastCheck = { x: L.spawn.x, y: L.spawn.y };
    this._spawnActors();
    this.player = new Player(this.lastCheck.x, this.lastCheck.y);
    this.cam.x = this.cam.prevX = clamp(
      this.player.x - VIEW_W / 2,
      0,
      L.widthPx - VIEW_W,
    );
    this.cam.y = this.cam.prevY = clamp(
      this.player.y - 330,
      0,
      L.heightPx - VIEW_H,
    );
    if (!attract) {
      this.banner = 3.0;
      this.bannerText = ["MÀN " + (idx + 1) + " — " + L.name, L.sub];
      this.fade = 1;
      this.fadeDir = -1;
    }
    this._decoSeed = mulberry32(idx * 991 + 7);
  },

  _spawnActors() {
    const L = this.level;
    this.slimes = L.slimes.map((s) => new Slime(s.x, s.y));
    this.bats = L.bats.map((b) => new Bat(b.x, b.y));
    this.platforms = L.movers.map((m) => new MovingPlatform(m));
    this.shocks = [];
    this.boss =
      L.boss && !this.bossDefeated ? new Boss(L.boss.x, L.boss.y) : null;
    if (this.boss) this.bossFloorY = L.boss.y;
  },

  startGame() {
    this.loadLevel(0);
    this.state = "play";
    this.coinCount = 0;
    this.deaths = 0;
    this.runTime = 0;
    this.timerOn = true;
    this.showScreen(null);
    AudioSys.music("level");
    this._goFullscreen();
  },

  // toàn màn hình + khoá ngang trên máy cảm ứng (best-effort).
  // manual=true: gọi từ nút bấm của người dùng — nếu không hỗ trợ hoặc
  // thất bại thì hiện hướng dẫn "Thêm vào Màn hình chính" (Safari iPhone
  // không có Fullscreen API cho trang thường, chỉ cách đó mới ẩn được
  // thanh địa chỉ thật sự). manual=false (gọi tự động lúc bắt đầu chơi):
  // im lặng bỏ qua nếu thất bại, không làm phiền người chơi.
  _goFullscreen(manual) {
    if (document.fullscreenElement) return;
    if (!manual && !this.isTouch) return;
    const el = document.documentElement;
    const req = el.requestFullscreen
      ? () => el.requestFullscreen({ navigationUI: "hide" })
      : el.webkitRequestFullscreen
        ? () => el.webkitRequestFullscreen()
        : null;
    if (!req) {
      if (manual) this._showFsTip();
      return;
    }
    try {
      const afterEnter = () => {
        if (screen.orientation && screen.orientation.lock)
          screen.orientation.lock("landscape").catch(() => {});
      };
      const p = req();
      if (p && p.then)
        p.then(afterEnter).catch(() => {
          if (manual) this._showFsTip();
        });
      else afterEnter();
    } catch (e) {
      if (manual) this._showFsTip();
    }
  },

  // nút ⛶ luôn hiện trên các màn hình menu (title/howto/pause/victory) khi
  // chơi bằng cảm ứng — tách khỏi #touch-ui vì nút đó chỉ hiện lúc đang chơi
  _bindFullscreenButton() {
    const btn = document.getElementById("fs-btn");
    const tip = document.getElementById("fs-tip");
    const closeBtn = document.getElementById("fs-tip-close");
    if (!btn || !tip) return;
    const standalone =
      window.navigator.standalone === true ||
      matchMedia("(display-mode: standalone)").matches;
    if (standalone) return; // đã chạy dạng app toàn màn hình — không cần nút
    btn.addEventListener("click", () => {
      AudioSys.ensure();
      AudioSys.sfx("ui");
      this._goFullscreen(true);
    });
    if (closeBtn)
      closeBtn.addEventListener("click", () => {
        AudioSys.sfx("ui");
        tip.classList.remove("show");
      });
  },

  _showFsTip() {
    const tip = document.getElementById("fs-tip");
    if (tip) tip.classList.add("show");
  },

  quitToTitle() {
    this.paused = false;
    this.state = "title";
    this.loadLevel(0, true);
    this.showScreen("title");
    AudioSys.music("title");
  },

  restartAll() {
    this.startGame();
  },

  togglePause() {
    if (this.state !== "play") return;
    this.paused = !this.paused;
    this.showScreen(this.paused ? "pause" : null);
    if (this.paused) AudioSys.sfx("ui");
  },

  // ================= CƠ CHẾ =================
  tileAt(px, py) {
    const L = this.level;
    const c = Math.floor(px / TILE),
      r = Math.floor(py / TILE);
    if (c < 0 || c >= L.w) return 1; // mép màn = tường
    if (r < 0 || r >= L.h) return 0;
    return L.grid[r * L.w + c];
  },

  solid(t) {
    return t === 1 || t === 2;
  },

  moveEntity(e, dt) {
    e.hitWall = false;
    e.hitCeil = false;
    const prevFeet = e.y;
    // --- trục X
    e.x += e.vx * dt;
    const top = e.y - e.h + 3,
      bot = e.y - 3;
    if (e.vx > 0) {
      const edge = e.x + e.w / 2;
      if (
        this.solid(this.tileAt(edge, top)) ||
        this.solid(this.tileAt(edge, (top + bot) / 2)) ||
        this.solid(this.tileAt(edge, bot))
      ) {
        e.x = Math.floor(edge / TILE) * TILE - e.w / 2 - 0.01;
        e.vx = 0;
        e.hitWall = true;
      }
    } else if (e.vx < 0) {
      const edge = e.x - e.w / 2;
      if (
        this.solid(this.tileAt(edge, top)) ||
        this.solid(this.tileAt(edge, (top + bot) / 2)) ||
        this.solid(this.tileAt(edge, bot))
      ) {
        e.x = (Math.floor(edge / TILE) + 1) * TILE + e.w / 2 + 0.01;
        e.vx = 0;
        e.hitWall = true;
      }
    }
    // --- trục Y (chân đỡ thu vào 6px để không đứng lơ lửng quá mép)
    e.y += e.vy * dt;
    e.onGround = false;
    const lx = e.x - e.w / 2 + 6,
      rx = e.x + e.w / 2 - 6;
    if (e.vy >= 0) {
      const feet = e.y;
      const tL = this.tileAt(lx, feet),
        tR = this.tileAt(rx, feet);
      const landSolid = this.solid(tL) || this.solid(tR);
      const tileTop = Math.floor(feet / TILE) * TILE;
      const landOne = (tL === 3 || tR === 3) && prevFeet <= tileTop + 6;
      if (landSolid || landOne) {
        e.y = tileTop - 0.01;
        e.vy = 0;
        e.onGround = true;
      }
    } else {
      const head = e.y - e.h;
      if (
        this.solid(this.tileAt(lx, head)) ||
        this.solid(this.tileAt(rx, head))
      ) {
        e.y = (Math.floor(head / TILE) + 1) * TILE + e.h + 0.01;
        e.vy = 0;
        e.hitCeil = true;
      }
    }
  },

  addShake(n) {
    this.trauma = Math.min(1, this.trauma + n / 22);
  },
  hitStop(sec) {
    this.hitStopT = Math.max(this.hitStopT, sec);
  },

  spawnShockwaves(x, y) {
    this.shocks.push(new Shockwave(x - 30, y, -1));
    this.shocks.push(new Shockwave(x + 30, y, 1));
  },

  damagePlayer(dir) {
    this.player.hurt(dir);
  },
  onHpChange() {
    this.hudHpPulse = 1;
  },
  onBossHp() {
    /* HUD tự đọc */
  },

  onPlayerDeath() {
    this.deaths++;
    this.deathT = 0;
  },

  onBossDying() {
    this.timeScale = 0.25;
    AudioSys.music(null);
  },

  onBossDefeated() {
    this.bossDefeated = true;
    this.bossActive = false;
    this.state = "cutscene";
    this.cutT = 0;
    this._cutsceneSkip = false;
    this._fwT = 0;
    // công chúa bay xuống sân
    if (this.princess) {
      this.princess.mode = "descend";
      this.princess.tx = this.princess.x - 60;
      this.princess.ty = this.bossFloorY;
    }
  },

  // ================= UPDATE =================
  update(dt) {
    this.time += dt;
    Background.update(dt);
    Particles.update(dt);
    this.timeScale = damp(this.timeScale, 1, 1.4, dt);
    this.trauma = Math.max(0, this.trauma - dt * 1.7);
    this.banner = Math.max(0, this.banner - dt);
    this.hudCoinBump = Math.max(0, this.hudCoinBump - dt * 3);
    this.hudHpPulse = Math.max(0, this.hudHpPulse - dt * 2);
    this.fade = clamp(this.fade + this.fadeDir * dt * 1.6, 0, 1);

    for (const t of this.torches) t.update(dt);
    for (const c of this.coins) c.update(dt);
    for (const h of this.hearts) h.update(dt);
    for (const c of this.checks) c.update(dt);
    if (this.door) this.door.update(dt);

    if (this.state === "title") {
      this._updateAttract(dt);
      return;
    }
    if (this.state === "cutscene") {
      this._updateCutscene(dt);
      return;
    }
    if (this.state === "clear") {
      this._updateClear(dt);
      return;
    }
    if (this.state !== "play") return;

    if (this.timerOn) this.runTime += dt;

    // --- thế giới
    for (const p of this.platforms) p.update(dt);
    for (const s of this.slimes) if (!s.dead) s.update(dt);
    for (const b of this.bats) if (!b.dead) b.update(dt);
    for (const s of this.shocks) s.update(dt);
    this.shocks = this.shocks.filter((s) => !s.dead);
    if (this.boss) this.boss.update(dt);
    if (this.princess) this.princess.update(dt);

    // --- người chơi
    const pl = this.player;
    if (pl.dead) {
      pl.update(dt);
      this.deathT += dt;
      if (this.deathT > 0.9 && this.fadeDir !== 1) this.fadeDir = 1;
      if (this.fade >= 1 && this.fadeDir === 1) this._respawn();
      this._updateCam(dt);
      return;
    }
    pl.update(dt);
    this._platformCarry(pl, dt);

    // --- boss arena
    if (
      this.gate &&
      this.boss &&
      this.boss.state === "wait" &&
      pl.x > this.gate.x
    ) {
      this.bossActive = true;
      this.barrierX = this.gate.x - 2.5 * TILE;
      const towerX = (this.level.w - 4) * TILE;
      this.boss.activate(this.barrierX, towerX);
      AudioSys.music("boss");
    }
    if (this.bossActive) {
      this.barrierA = Math.min(1, this.barrierA + dt * 2);
      if (pl.x - pl.w / 2 < this.barrierX) {
        pl.x = this.barrierX + pl.w / 2;
        pl.vx = Math.max(0, pl.vx);
      }
    } else this.barrierA = Math.max(0, this.barrierA - dt * 2);

    this._interactions(dt);
    this._updateCam(dt);

    // rơi vực
    if (pl.y - pl.h > this.level.heightPx + 80) pl.die();
  },

  _platformCarry(pl, dt) {
    const wasOn = pl.onPlat;
    pl.onPlat = false;
    if (pl.vy < -1) return;
    for (const p of this.platforms) {
      const top = p.y - p.h;
      // tâm người phải nằm trong mặt platform (+4px) — không đứng lơ lửng ngoài mép
      const overX = Math.abs(pl.x - p.x) < p.w / 2 + 4;
      if (!overX) continue;
      const prevFeet = pl.prevY !== undefined ? pl.prevY : pl.y;
      if (pl.y >= top - 2 && prevFeet <= top + 14 && pl.y <= top + 20) {
        const fell = pl.lastFallV || 0;
        // phản hồi va chạm khi vừa đáp: bụi, squash, lún platform, tiếng
        if (!wasOn && !pl.onGround && fell > 200) {
          const pow = clamp(fell / 900, 0.3, 1.4);
          Particles.dustLand(pl.x, top, pow);
          pl.sqX = 1 + 0.3 * pow;
          pl.sqY = 1 - 0.25 * pow;
          p.land(pow);
          if (fell > 350) AudioSys.sfx("stomp");
        }
        pl.y = top;
        pl.vy = 0;
        pl.onGround = true;
        pl.onPlat = true;
        pl.x += p.dx;
        pl.y += p.dy;
        pl.coyote = 0.1;
        pl.jumps = 0;
        pl.canDash = true;
        // bụi khi chạy trên platform (Player.update bỏ qua vì lúc đó chưa onGround;
        // stepT đã được Player.update trừ dần)
        if (Math.abs(pl.vx) > 160 && pl.stepT <= 0) {
          pl.stepT = 0.09;
          Particles.dustRun(pl.x, top, pl.face);
        }
      }
    }
  },

  _interactions(dt) {
    const pl = this.player;
    const pr = pl.rect;

    // gai
    if (!pl.invul) {
      const pts = [
        [pr[0] + 4, pr[1] + pr[3] - 2],
        [pr[0] + pr[2] - 4, pr[1] + pr[3] - 2],
        [pr[0] + pr[2] / 2, pr[1] + pr[3] - 1],
      ];
      for (const [px, py] of pts) {
        if (this.tileAt(px, py) === 4) {
          pl.vy = -480;
          this.damagePlayer(pl.face * -1);
          break;
        }
      }
    }

    // kiếm chém
    if (pl.atkActive) {
      const ar = pl.atkRect;
      for (const s of this.slimes)
        if (!s.dead && aabb(...ar, ...s.rect)) s.kill(false);
      for (const b of this.bats)
        if (!b.dead && aabb(...ar, ...b.rect)) b.kill(false);
      if (this.boss && !this.boss.dead && this.boss.state !== "wait") {
        if (aabb(...ar, ...this.boss.rect) && !this._swungAtBoss) {
          this.boss.hitByPlayer();
          this._swungAtBoss = true;
        }
      }
    } else this._swungAtBoss = false;

    // chạm quái
    const touchEnemy = (e) => {
      if (e.dead || !aabb(...pr, ...e.rect)) return;
      const stomping = pl.vy > 120 && pl.y - pl.h * 0.5 < e.y - e.h * 0.6;
      if (stomping) {
        e.kill(true);
        pl.bounce();
        this.hitStop(0.04);
        this.addShake(2);
      } else if (!pl.invul) {
        this.damagePlayer(pl.x < e.x ? -1 : 1);
      }
    };
    for (const s of this.slimes) touchEnemy(s);
    for (const b of this.bats) touchEnemy(b);

    // boss chạm
    const bo = this.boss;
    if (
      bo &&
      !bo.dead &&
      bo.state !== "wait" &&
      bo.state !== "dying" &&
      aabb(...pr, ...bo.rect)
    ) {
      if (
        bo.vulnerable &&
        pl.vy > 120 &&
        pl.y - pl.h * 0.5 < bo.y - bo.h * 0.55
      ) {
        bo.hitByPlayer();
        pl.bounce();
      } else if (!bo.vulnerable && !pl.invul) {
        // boss đang choáng thì chạm vào an toàn — để người chơi phản công
        this.damagePlayer(pl.x < bo.x ? -1 : 1);
      }
    }
    for (const s of this.shocks) {
      // 0.18s đầu sóng chưa "vũ trang" — không có đòn spawn sát người
      if (s.t > 0.18 && !pl.invul && aabb(...pr, ...s.rect))
        this.damagePlayer(pl.x < s.x ? -1 : 1);
    }

    // xu / tim
    for (const c of this.coins) {
      if (c.got) continue;
      const dx = c.x - pl.x,
        dy = c.y - (pl.y - pl.h / 2);
      if (dx * dx + dy * dy < 34 * 34) {
        c.got = true;
        this.coinCount++;
        this.hudCoinBump = 1;
        AudioSys.sfx("coin");
        Particles.coinBurst(c.x, c.y);
      }
    }
    for (const h of this.hearts) {
      if (h.got) continue;
      const dx = h.x - pl.x,
        dy = h.y - (pl.y - pl.h / 2);
      if (dx * dx + dy * dy < 36 * 36) {
        h.got = true;
        AudioSys.sfx("heart");
        Particles.heal(pl.x, pl.y - pl.h / 2);
        if (pl.hp < pl.maxHp) {
          pl.hp++;
          this.onHpChange();
        }
      }
    }

    // checkpoint
    for (const c of this.checks) {
      if (!c.on && Math.abs(c.x - pl.x) < 34 && Math.abs(c.y - pl.y) < 60) {
        c.activate();
        this.lastCheck = { x: c.x, y: c.y };
      }
    }

    // cửa thoát
    if (this.door && aabb(...pr, ...this.door.rect)) {
      this.state = "clear";
      this.clearT = 0;
      AudioSys.sfx("door");
    }
  },

  _respawn() {
    const keepChecks = this.checks;
    this._spawnActors();
    this.player = new Player(this.lastCheck.x, this.lastCheck.y);
    this.checks = keepChecks;
    this.fadeDir = -1;
    this.deathT = -1;
    this.bossActive = false;
    this.barrierA = 0;
    if (AudioSys._songName === "boss") AudioSys.music("level");
  },

  _updateClear(dt) {
    this.clearT += dt;
    const pl = this.player;
    // tự bước vào cửa
    if (this.door) {
      pl.vx = clamp((this.door.x - pl.x) * 4, -160, 160);
      pl.vy += 2400 * dt;
      pl.face = Math.sign(this.door.x - pl.x) || pl.face;
      this.moveEntity(pl, dt);
      pl._anim(dt);
    }
    if (this.clearT > 0.8 && this.fadeDir !== 1) this.fadeDir = 1;
    if (this.fade >= 1 && this.fadeDir === 1) {
      this.loadLevel(this.levelIdx + 1);
      this.state = "play";
      AudioSys.music("level");
    }
    this._updateCam(dt);
  },

  _updateCutscene(dt) {
    this.cutT += dt;
    this.barrierA = Math.max(0, this.barrierA - dt * 1.5);
    const pl = this.player,
      prin = this.princess;
    // hiệp sĩ đứng thở, quay mặt về công chúa
    pl.vx = 0;
    pl.vy += 2400 * dt;
    this.moveEntity(pl, dt);
    pl._anim(dt);
    if (prin) {
      if (prin.mode === "descend" || prin.mode === "run")
        prin.tx = prin.mode === "run" ? pl.x + 44 : prin.tx;
      prin.update(dt);
      pl.face = prin.x > pl.x ? 1 : -1;
      if (prin.mode === "reunited") {
        this._fwT -= dt;
        if (this._fwT <= 0) {
          this._fwT = 0.55;
          Particles.firework(
            this.cam.x + rand(200, VIEW_W - 200),
            this.cam.y + rand(60, 220),
            pick(["#FFD166", "#FF8FA3", "#9FC1E8", "#B18CFF", "#7BD34F"]),
          );
          if (!this._winPlayed) {
            AudioSys.sfx("win");
            this._winPlayed = true;
          }
        }
        if (!this._reuT) this._reuT = this.cutT;
      }
    }
    for (const t of this.platforms) t.update(dt);
    const doneWaiting = this._reuT && this.cutT - this._reuT > 3.2;
    if (doneWaiting || this._cutsceneSkip) this._showVictory();
    this._updateCam(dt);
  },

  _showVictory() {
    this.state = "victory";
    this.timerOn = false;
    this._winPlayed = false;
    this._reuT = 0;
    const mm = Math.floor(this.runTime / 60),
      ss = Math.floor(this.runTime % 60);
    document.getElementById("stat-time").textContent =
      mm + ":" + String(ss).padStart(2, "0");
    document.getElementById("stat-coins").textContent = this.coinCount;
    document.getElementById("stat-deaths").textContent = this.deaths;
    this.showScreen("victory");
    AudioSys.music("title");
  },

  _updateAttract(dt) {
    this.attractT += dt;
    const span = this.level.widthPx - VIEW_W;
    const u = (Math.sin(this.attractT * 0.07 - Math.PI / 2) + 1) / 2;
    this.cam.x = u * span;
    this.cam.y = this.level.heightPx - VIEW_H;
    for (const s of this.slimes) if (!s.dead) s.update(dt);
    for (const b of this.bats) if (!b.dead) b.update(dt);
    for (const p of this.platforms) p.update(dt);
  },

  _updateCam(dt) {
    const cam = this.cam,
      pl = this.player;
    let tx, ty;
    if (this.state === "cutscene" && this.princess) {
      tx = (pl.x + this.princess.x) / 2 - VIEW_W / 2;
      ty = pl.y - 360;
    } else if (this.bossActive && this.boss && !this.boss.dead) {
      tx = pl.x * 0.6 + this.boss.x * 0.4 - VIEW_W / 2;
      ty = pl.y - 330;
    } else {
      cam.look = damp(cam.look, pl.face * 70, 3, dt);
      tx = pl.x + cam.look - VIEW_W / 2;
      ty = pl.y - 330;
    }
    tx = clamp(tx, 0, this.level.widthPx - VIEW_W);
    ty = clamp(ty, 0, this.level.heightPx - VIEW_H);
    cam.x = damp(cam.x, tx, 8, dt);
    cam.y = damp(cam.y, ty, 6, dt);
  },

  // ================= FRAME =================
  _frame(now) {
    requestAnimationFrame((t) => this._frame(t));
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1;
    this._fpsAcc += dt;
    this._fpsN++;
    if (this._fpsAcc >= 0.5) {
      this.fps = Math.round(this._fpsN / this._fpsAcc);
      this._fpsAcc = 0;
      this._fpsN = 0;
    }

    if (this.hitStopT > 0) {
      this.hitStopT -= dt;
    } else if (!this.paused) {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP && steps < 4) {
        this._snapshot();
        this.update(STEP * this.timeScale);
        this.acc -= STEP;
        steps++;
      }
      if (steps === 4) this.acc = 0;
    }
    this.render(this.paused || this.hitStopT > 0 ? 1 : this.acc / STEP);
  },

  _snapshot() {
    const snap = (e) => {
      e.prevX = e.x;
      e.prevY = e.y;
    };
    if (this.player) snap(this.player);
    for (const s of this.slimes) snap(s);
    for (const b of this.bats) snap(b);
    for (const p of this.platforms) snap(p);
    for (const s of this.shocks) snap(s);
    if (this.boss) snap(this.boss);
    if (this.princess) snap(this.princess);
    this.cam.prevX = this.cam.x;
    this.cam.prevY = this.cam.y;
  },

  // ================= RENDER =================
  render(a) {
    const ctx = this.ctx;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);

    const camX = lerp(this.cam.prevX, this.cam.x, a);
    const camY = lerp(this.cam.prevY, this.cam.y, a);
    const sh = this.trauma * this.trauma;
    const shX =
      sh * 20 * (Math.sin(this.time * 91) + Math.sin(this.time * 53) * 0.6);
    const shY =
      sh * 14 * (Math.cos(this.time * 77) + Math.cos(this.time * 47) * 0.6);

    Background.draw(ctx, camX, camY);

    ctx.save();
    ctx.translate(-Math.round(camX + shX), -Math.round(camY + shY));

    this._drawTiles(ctx, camX, camY);
    if (this.door) this.door.draw(ctx);
    for (const c of this.checks) c.draw(ctx);
    for (const t of this.torches) t.draw(ctx);
    this._drawTower(ctx);
    for (const p of this.platforms) p.draw(ctx, a);
    for (const c of this.coins) c.draw(ctx);
    for (const h of this.hearts) h.draw(ctx);
    for (const s of this.slimes) if (!s.dead) s.draw(ctx, a);
    for (const b of this.bats) if (!b.dead) b.draw(ctx, a);
    for (const s of this.shocks) s.draw(ctx, a);
    if (this.boss) this.boss.draw(ctx, a);
    if (this.princess) this.princess.draw(ctx, a);
    if (this.state !== "title") this.player.draw(ctx, a);
    Particles.draw(ctx, "world");
    this._drawBarrier(ctx);
    ctx.restore();

    Background.drawFront(ctx, camX);
    if (this.state !== "title") this._drawHUD(ctx);
    Particles.draw(ctx, "screen");

    if (this.fade > 0.001) {
      ctx.fillStyle = `rgba(6,8,16,${this.fade})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  },

  _drawTiles(ctx, camX, camY) {
    const L = this.level,
      th = L.tileTheme;
    const c0 = Math.max(0, Math.floor(camX / TILE) - 1);
    const c1 = Math.min(L.w - 1, Math.ceil((camX + VIEW_W) / TILE) + 1);
    const r0 = Math.max(0, Math.floor(camY / TILE) - 1);
    const r1 = Math.min(L.h - 1, Math.ceil((camY + VIEW_H) / TILE) + 1);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const t = L.grid[r * L.w + c];
        if (!t) continue;
        const x = c * TILE,
          y = r * TILE;
        if (t === 1 || t === 2) {
          const stone = t === 2;
          const above = r > 0 ? L.grid[(r - 1) * L.w + c] : 0;
          const exposed = !this.solid(above);
          ctx.fillStyle = stone ? th.stone : th.body;
          ctx.fillRect(x, y, TILE, TILE);
          // hoa văn thân
          const rng = mulberry32(c * 7919 + r * 104729 + L.idx);
          ctx.fillStyle = stone ? th.stoneDark : th.dark;
          if (stone) {
            ctx.fillRect(x, y + TILE / 2 - 1, TILE, 2);
            ctx.fillRect(x + (rng() < 0.5 ? 12 : 30), y + 4, 2, TILE / 2 - 5);
            ctx.fillRect(
              x + (rng() < 0.5 ? 8 : 26),
              y + TILE / 2 + 2,
              2,
              TILE / 2 - 6,
            );
          } else {
            if (rng() < 0.5)
              ctx.fillRect(x + 6 + rng() * 24, y + 10 + rng() * 26, 5, 4);
            if (rng() < 0.4)
              ctx.fillRect(x + 8 + rng() * 22, y + 14 + rng() * 20, 4, 3);
          }
          if (exposed) {
            // nắp mặt trên
            const lift = stone ? th.stoneTop : th.top;
            const leftOpen = c === 0 || !this.solid(L.grid[r * L.w + c - 1]);
            const rightOpen =
              c === L.w - 1 || !this.solid(L.grid[r * L.w + c + 1]);
            ctx.fillStyle = lift;
            roundRectPath(ctx, x, y, TILE, 15, {
              tl: leftOpen ? 8 : 0,
              tr: rightOpen ? 8 : 0,
              br: 0,
              bl: 0,
            });
            ctx.fill();
            ctx.fillStyle = stone ? "rgba(255,255,255,0.25)" : th.lip;
            roundRectPath(
              ctx,
              x + (leftOpen ? 3 : 0),
              y,
              TILE - (leftOpen ? 3 : 0) - (rightOpen ? 3 : 0),
              4.5,
              2,
            );
            ctx.fill();
            // decor trên mặt cỏ/đá
            if (!stone) {
              const dr = mulberry32(c * 31 + L.idx * 77);
              if (dr() < 0.34) {
                // cỏ
                ctx.strokeStyle = th.lip;
                ctx.lineWidth = 2;
                ctx.lineCap = "round";
                const gx = x + 8 + dr() * 30;
                ctx.beginPath();
                ctx.moveTo(gx, y + 1);
                ctx.lineTo(gx - 2, y - 7);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(gx + 4, y + 1);
                ctx.lineTo(gx + 6, y - 5);
                ctx.stroke();
              }
              if (th.deco === "flower" && dr() < 0.18) {
                const fx = x + 8 + dr() * 30;
                ctx.fillStyle = pick(["#FF8FA3", "#FFD166", "#C9AAFF"]);
                for (let k = 0; k < 5; k++) {
                  const ang = (k / 5) * TAU;
                  ctx.beginPath();
                  ctx.arc(
                    fx + Math.cos(ang) * 3,
                    y - 8 + Math.sin(ang) * 3,
                    2.2,
                    0,
                    TAU,
                  );
                  ctx.fill();
                }
                ctx.fillStyle = "#FFF3C4";
                ctx.beginPath();
                ctx.arc(fx, y - 8, 2, 0, TAU);
                ctx.fill();
              }
            } else if (th.deco === "crystal") {
              const dr = mulberry32(c * 53 + L.idx * 13);
              if (dr() < 0.12) {
                const cx2 = x + 10 + dr() * 26;
                ctx.save();
                ctx.globalCompositeOperation = "lighter";
                ctx.fillStyle = hexA("#B18CFF", 0.8);
                ctx.beginPath();
                ctx.moveTo(cx2 - 5, y);
                ctx.lineTo(cx2, y - 13 - dr() * 6);
                ctx.lineTo(cx2 + 5, y);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
              }
            }
          }
        } else if (t === 3) {
          // platform một chiều
          ctx.fillStyle = th.plank;
          roundRectPath(ctx, x + 1, y, TILE - 2, 13, 5);
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.22)";
          roundRectPath(ctx, x + 3, y + 2, TILE - 6, 3.5, 2);
          ctx.fill();
          ctx.fillStyle = "rgba(0,0,0,0.22)";
          ctx.fillRect(x + 7, y + 9, 4, 4);
          ctx.fillRect(x + TILE - 11, y + 9, 4, 4);
        } else if (t === 4) {
          // gai
          const g = ctx.createLinearGradient(0, y + 6, 0, y + TILE);
          g.addColorStop(0, th.spikeTip);
          g.addColorStop(1, th.spike);
          ctx.fillStyle = g;
          for (let k = 0; k < 3; k++) {
            const sx = x + k * 16;
            ctx.beginPath();
            ctx.moveTo(sx + 1, y + TILE);
            ctx.lineTo(sx + 8, y + 7);
            ctx.lineTo(sx + 15, y + TILE);
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }
  },

  _drawTower(ctx) {
    // trang trí tháp công chúa (màn 3): răng cưa, cờ hiệu và LỒNG ĐÈN —
    // chính là "ánh sáng dẫn đường" đã thấy từ chân trời các màn trước
    if (!this.level.princess) return;
    const px = this.level.princess.x;
    const topY = this.level.princess.y; // mặt tháp
    const towerL = Math.floor((px - 24) / TILE) * TILE - TILE;
    ctx.save();
    // răng cưa mép tháp
    ctx.fillStyle = "#565078";
    for (let i = 0; i < 4; i++)
      ctx.fillRect(towerL + 4 + i * 38, topY - 10, 18, 10);
    // cờ hiệu hồng trên cột
    const fx = towerL + 10;
    ctx.strokeStyle = "#8A93A8";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(fx, topY - 8);
    ctx.lineTo(fx, topY - 54);
    ctx.stroke();
    const wv = Math.sin(this.time * 4) * 4;
    ctx.fillStyle = "#FF8FA3";
    ctx.beginPath();
    ctx.moveTo(fx + 2, topY - 52);
    ctx.quadraticCurveTo(
      fx + 16,
      topY - 50 + wv * 0.5,
      fx + 28,
      topY - 46 + wv,
    );
    ctx.lineTo(fx + 28, topY - 38 + wv);
    ctx.quadraticCurveTo(fx + 16, topY - 42 + wv * 0.5, fx + 2, topY - 40);
    ctx.closePath();
    ctx.fill();
    // lồng đèn — nguồn "ánh sáng dẫn đường"
    const lx = px + 40,
      lyTop = topY - 58;
    ctx.strokeStyle = "#6B617F";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(lx, topY);
    ctx.lineTo(lx, lyTop);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(lx, lyTop);
    ctx.lineTo(lx + 14, lyTop + 4);
    ctx.stroke();
    const ly = lyTop + 14;
    const pulse = 1 + Math.sin(this.time * 2.2) * 0.12;
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(
      glowTex("#FFE9A8", 128),
      lx + 14 - 55 * pulse,
      ly - 55 * pulse,
      110 * pulse,
      110 * pulse,
    );
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#4A4330";
    roundRectPath(ctx, lx + 8, lyTop + 2, 12, 4, 2);
    ctx.fill();
    const lg = ctx.createLinearGradient(0, ly - 8, 0, ly + 10);
    lg.addColorStop(0, "#FFF3C4");
    lg.addColorStop(1, "#FFC96B");
    ctx.fillStyle = lg;
    roundRectPath(ctx, lx + 8, ly - 8, 12, 18, 5);
    ctx.fill();
    ctx.restore();
  },

  _drawBarrier(ctx) {
    if (this.barrierA <= 0.01) return;
    const x = this.barrierX;
    const topY = this.bossFloorY - 300;
    ctx.save();
    ctx.globalAlpha = this.barrierA * (0.55 + Math.sin(this.time * 6) * 0.15);
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createLinearGradient(x - 10, 0, x + 10, 0);
    g.addColorStop(0, "rgba(177,140,255,0)");
    g.addColorStop(0.5, "rgba(177,140,255,0.75)");
    g.addColorStop(1, "rgba(177,140,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 10, topY, 20, 300);
    for (let i = 0; i < 5; i++) {
      const yy = topY + ((this.time * 60 + i * 60) % 300);
      ctx.fillStyle = "rgba(230,215,255,0.7)";
      ctx.fillRect(x - 3, yy, 6, 10);
    }
    ctx.restore();
  },

  // ================= HUD =================
  _drawHUD(ctx) {
    const pl = this.player;
    ctx.save();
    ctx.textBaseline = "middle";

    // tim
    const pulse = 1 + this.hudHpPulse * 0.25;
    for (let i = 0; i < pl.maxHp; i++) {
      const x = 34 + i * 34,
        y = 34;
      const filled = i < pl.hp;
      const s = filled ? 24 * (i === pl.hp - 1 ? pulse : 1) : 22;
      ctx.save();
      ctx.translate(x, y);
      if (filled) {
        ctx.drawImage(
          glowTex("#FF8FA3", 64),
          -s * 0.8,
          -s * 0.8,
          s * 1.6,
          s * 1.6,
        );
        const g = ctx.createLinearGradient(0, -s / 2, 0, s / 2);
        g.addColorStop(0, "#FFB3C1");
        g.addColorStop(1, "#F2455F");
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = "rgba(10,12,24,0.45)";
      }
      heartPath(ctx, 0, -s * 0.42, s);
      ctx.fill();
      if (!filled) {
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 2;
        heartPath(ctx, 0, -s * 0.42, s);
        ctx.stroke();
      }
      ctx.restore();
    }

    // xu (trên máy cảm ứng dịch trái để tránh nút tạm dừng)
    const hudR = this.isTouch ? 58 : 0;
    const bump = 1 + this.hudCoinBump * 0.2;
    ctx.save();
    ctx.translate(VIEW_W - 108 - hudR, 34);
    ctx.scale(bump, bump);
    ctx.drawImage(glowTex("#FFD166", 64), -16, -16, 32, 32);
    const cg = ctx.createLinearGradient(0, -9, 0, 9);
    cg.addColorStop(0, "#FFE9A8");
    cg.addColorStop(1, "#F5B63F");
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#C98A1B";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 6.6, 0, TAU);
    ctx.stroke();
    ctx.restore();
    ctx.font =
      '800 22px ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = "#FFF7E0";
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 6;
    ctx.textAlign = "left";
    ctx.fillText(String(this.coinCount), VIEW_W - 88 - hudR, 35);

    // thời gian
    const mm = Math.floor(this.runTime / 60),
      ss = Math.floor(this.runTime % 60);
    ctx.font =
      '700 15px ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.textAlign = "right";
    ctx.fillText(
      mm + ":" + String(ss).padStart(2, "0"),
      VIEW_W - 26 - hudR,
      62,
    );
    ctx.shadowBlur = 0;

    // thanh máu boss
    if (
      this.bossActive &&
      this.boss &&
      !this.boss.dead &&
      this.boss.state !== "wait"
    ) {
      const bw = 380,
        bx = VIEW_W / 2 - bw / 2,
        by = VIEW_H - 46;
      ctx.textAlign = "center";
      ctx.font =
        '800 15px ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = "#D8CBFF";
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 5;
      ctx.fillText("HẮC KỴ SĨ", VIEW_W / 2, by - 14);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(8,8,20,0.55)";
      roundRectPath(ctx, bx, by, bw, 14, 7);
      ctx.fill();
      const frac = this.boss.hp / this.boss.maxHp;
      if (frac > 0) {
        const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
        g.addColorStop(0, "#B18CFF");
        g.addColorStop(1, "#7A4EE8");
        ctx.fillStyle = g;
        roundRectPath(ctx, bx + 2, by + 2, (bw - 4) * frac, 10, 5);
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1.5;
      roundRectPath(ctx, bx, by, bw, 14, 7);
      ctx.stroke();
    }

    // banner tên màn
    if (this.banner > 0) {
      const t = 3.0 - this.banner;
      const aIn = clamp(t * 2.4, 0, 1),
        aOut = clamp(this.banner * 1.4, 0, 1);
      const al = Math.min(aIn, aOut);
      const rise = (1 - ease.outCubic(aIn)) * 24;
      ctx.globalAlpha = al;
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(8,10,22,0.35)";
      roundRectPath(ctx, VIEW_W / 2 - 300, 128 + rise, 600, 92, 20);
      ctx.fill();
      ctx.font =
        '800 36px ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = "#FFF7E0";
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = 10;
      ctx.fillText(this.bannerText[0], VIEW_W / 2, 168 + rise);
      ctx.shadowBlur = 0;
      ctx.font =
        '600 17px ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = "#FFD166";
      ctx.fillText(this.bannerText[1], VIEW_W / 2, 200 + rise);
      ctx.globalAlpha = 1;
    }

    // gợi ý cứu công chúa trong cutscene
    if (this.state === "cutscene" && this.cutT > 1.5) {
      ctx.globalAlpha = 0.8;
      ctx.textAlign = "center";
      ctx.font =
        '600 14px ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillText(
        this.isTouch ? "Chạm màn hình để tiếp tục" : "Enter — tiếp tục",
        VIEW_W / 2,
        VIEW_H - 24,
      );
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  },
};

window.__game = Game;
// boot ngay nếu DOM đã sẵn (trang được chèn động — vd. artifact viewer)
if (document.readyState === "loading")
  addEventListener("DOMContentLoaded", () => Game.boot());
else Game.boot();
