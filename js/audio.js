/* audio.js — SFX synth + nhạc nền procedural (WebAudio, không cần file) */
"use strict";

const AudioSys = {
  ctx: null,
  master: null,
  sfxBus: null,
  musicBus: null,
  muted: false,
  _noiseBuf: null,
  // music state
  _song: null,
  _songName: null,
  _timer: null,
  _step: 0,
  _nextT: 0,

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 20;
    comp.ratio.value = 6;
    this.master.connect(comp);
    comp.connect(c.destination);
    this.sfxBus = c.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(this.master);
    this.musicBus = c.createGain();
    this.musicBus.gain.value = 0.42;
    this.musicBus.connect(this.master);
    // noise buffer dùng chung
    const len = c.sampleRate * 1;
    this._noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this._noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (this._songName) this._startScheduler();
    return true;
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.master)
      this.master.gain.setTargetAtTime(
        this.muted ? 0 : 0.55,
        this.ctx.currentTime,
        0.03,
      );
    return this.muted;
  },

  // ---- SFX ----
  _tone({
    f0 = 440,
    f1 = f0,
    t = 0,
    dur = 0.15,
    type = "sine",
    g = 0.3,
    curve = "exp",
  }) {
    const c = this.ctx,
      now = c.currentTime + t;
    const o = c.createOscillator(),
      gn = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, now);
    if (f1 !== f0) {
      if (curve === "exp" && f0 > 0 && f1 > 0)
        o.frequency.exponentialRampToValueAtTime(f1, now + dur);
      else o.frequency.linearRampToValueAtTime(f1, now + dur);
    }
    gn.gain.setValueAtTime(g, now);
    gn.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(gn);
    gn.connect(this.sfxBus);
    o.start(now);
    o.stop(now + dur + 0.02);
  },

  _noise({
    t = 0,
    dur = 0.2,
    g = 0.3,
    f = 1200,
    q = 1,
    type = "bandpass",
    slide = 0,
  }) {
    const c = this.ctx,
      now = c.currentTime + t;
    const src = c.createBufferSource();
    src.buffer = this._noiseBuf;
    src.loop = true;
    const flt = c.createBiquadFilter();
    flt.type = type;
    flt.frequency.setValueAtTime(f, now);
    flt.Q.value = q;
    if (slide)
      flt.frequency.exponentialRampToValueAtTime(
        Math.max(60, f + slide),
        now + dur,
      );
    const gn = c.createGain();
    gn.gain.setValueAtTime(g, now);
    gn.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(flt);
    flt.connect(gn);
    gn.connect(this.sfxBus);
    src.start(now);
    src.stop(now + dur + 0.02);
  },

  sfx(name) {
    if (!this.ensure()) return;
    switch (name) {
      case "jump":
        this._tone({ f0: 330, f1: 660, dur: 0.14, type: "square", g: 0.12 });
        this._noise({ dur: 0.06, g: 0.05, f: 900 });
        break;
      case "djump":
        this._tone({ f0: 440, f1: 880, dur: 0.16, type: "square", g: 0.11 });
        this._tone({
          f0: 660,
          f1: 990,
          t: 0.03,
          dur: 0.12,
          type: "sine",
          g: 0.08,
        });
        break;
      case "dash":
        this._noise({ dur: 0.22, g: 0.22, f: 2400, slide: -1900, q: 0.7 });
        break;
      case "slash":
        this._noise({ dur: 0.12, g: 0.25, f: 3200, slide: -2400, q: 2 });
        this._tone({ f0: 700, f1: 220, dur: 0.08, type: "sawtooth", g: 0.06 });
        break;
      case "clang":
        this._tone({ f0: 1800, f1: 1400, dur: 0.1, type: "square", g: 0.1 });
        this._noise({ dur: 0.08, g: 0.15, f: 4000, q: 4 });
        break;
      case "stomp":
        this._tone({ f0: 300, f1: 90, dur: 0.16, type: "triangle", g: 0.3 });
        this._noise({ dur: 0.1, g: 0.12, f: 500 });
        break;
      case "kill":
        this._tone({ f0: 500, f1: 120, dur: 0.2, type: "sawtooth", g: 0.14 });
        this._noise({ dur: 0.15, g: 0.14, f: 800, slide: -500 });
        break;
      case "coin":
        this._tone({ f0: 987, dur: 0.09, type: "triangle", g: 0.16 });
        this._tone({ f0: 1318, t: 0.07, dur: 0.22, type: "triangle", g: 0.16 });
        break;
      case "heart":
        this._tone({ f0: 660, dur: 0.1, type: "sine", g: 0.18 });
        this._tone({ f0: 880, t: 0.09, dur: 0.12, type: "sine", g: 0.18 });
        this._tone({ f0: 1100, t: 0.18, dur: 0.25, type: "sine", g: 0.16 });
        break;
      case "hurt":
        this._tone({ f0: 240, f1: 90, dur: 0.28, type: "sawtooth", g: 0.22 });
        this._noise({ dur: 0.2, g: 0.2, f: 700, slide: -400 });
        break;
      case "die":
        this._tone({ f0: 400, f1: 60, dur: 0.7, type: "sawtooth", g: 0.2 });
        this._noise({ dur: 0.5, g: 0.18, f: 900, slide: -700 });
        break;
      case "check":
        this._tone({ f0: 587, dur: 0.1, type: "triangle", g: 0.15 });
        this._tone({ f0: 880, t: 0.1, dur: 0.14, type: "triangle", g: 0.15 });
        this._tone({ f0: 1174, t: 0.22, dur: 0.3, type: "triangle", g: 0.13 });
        break;
      case "door":
        this._tone({ f0: 220, f1: 440, dur: 0.5, type: "sine", g: 0.2 });
        this._tone({
          f0: 330,
          f1: 660,
          t: 0.1,
          dur: 0.5,
          type: "sine",
          g: 0.14,
        });
        break;
      case "boss_hit":
        this._tone({ f0: 220, f1: 80, dur: 0.25, type: "square", g: 0.24 });
        this._noise({ dur: 0.2, g: 0.22, f: 1500, slide: -1200 });
        break;
      case "boss_roar":
        this._tone({ f0: 90, f1: 50, dur: 0.8, type: "sawtooth", g: 0.3 });
        this._noise({ dur: 0.7, g: 0.2, f: 300, slide: 200, q: 0.5 });
        break;
      case "boss_die":
        for (let i = 0; i < 5; i++) {
          this._tone({
            f0: 500 - i * 80,
            f1: 60,
            t: i * 0.12,
            dur: 0.3,
            type: "sawtooth",
            g: 0.16,
          });
          this._noise({
            t: i * 0.12,
            dur: 0.25,
            g: 0.14,
            f: 1200 - i * 180,
            slide: -600,
          });
        }
        break;
      case "slam":
        this._tone({ f0: 150, f1: 40, dur: 0.4, type: "triangle", g: 0.4 });
        this._noise({ dur: 0.3, g: 0.3, f: 400, slide: -300 });
        break;
      case "ui":
        this._tone({ f0: 660, dur: 0.06, type: "triangle", g: 0.12 });
        this._tone({ f0: 990, t: 0.05, dur: 0.09, type: "triangle", g: 0.1 });
        break;
      case "win": {
        // fanfare ngắn
        const seq = [
          [523, 0, 0.14],
          [659, 0.14, 0.14],
          [784, 0.28, 0.14],
          [1046, 0.42, 0.5],
          [784, 0.62, 0.12],
          [1046, 0.74, 0.8],
        ];
        for (const [f, t, d] of seq) {
          this._tone({ f0: f, t, dur: d, type: "triangle", g: 0.2 });
          this._tone({ f0: f / 2, t, dur: d, type: "sine", g: 0.12 });
        }
        break;
      }
    }
  },

  // ---- MUSIC ----
  // Bài = {bpm, bars: mảng hợp âm (midi offsets so với root), root, bass, arp, lead:[{n,len}], drums}
  _songs: {
    title: {
      bpm: 82,
      root: 57 /* A3 */,
      bars: [
        [0, 4, 7, 11],
        [-4, 0, 4, 7],
        [-7, -3, 0, 4],
        [-5, -1, 2, 7],
      ],
      arpGain: 0.16,
      arpType: "sine",
      arpOct: 12,
      bassGain: 0.14,
      leadGain: 0,
      lead: [],
      hat: false,
      kick: false,
      pad: true,
    },
    level: {
      bpm: 116,
      root: 57,
      bars: [
        [0, 4, 7],
        [7, 11, 14],
        [9, 12, 16],
        [5, 9, 12],
      ],
      arpGain: 0.1,
      arpType: "triangle",
      arpOct: 12,
      bassGain: 0.17,
      leadGain: 0.13,
      leadType: "square",
      // giai điệu 2 bar (16 x 8th), số = midi offset so với root+12, null = nghỉ
      lead: [
        12,
        null,
        16,
        null,
        19,
        16,
        19,
        21,
        24,
        null,
        21,
        19,
        16,
        null,
        14,
        16,
        12,
        null,
        16,
        19,
        null,
        19,
        21,
        19,
        16,
        null,
        14,
        11,
        12,
        null,
        null,
        null,
      ],
      hat: true,
      kick: true,
      pad: false,
    },
    boss: {
      bpm: 148,
      root: 50 /* D3 */,
      bars: [
        [0, 3, 7],
        [-4, 0, 3],
        [-2, 2, 5],
        [-5, -2, 2],
      ],
      arpGain: 0.09,
      arpType: "sawtooth",
      arpOct: 12,
      bassGain: 0.2,
      leadGain: 0.12,
      leadType: "sawtooth",
      lead: [
        12,
        12,
        null,
        15,
        null,
        14,
        15,
        17,
        12,
        12,
        null,
        10,
        null,
        8,
        10,
        7,
        12,
        12,
        null,
        15,
        null,
        17,
        18,
        17,
        15,
        null,
        14,
        null,
        15,
        null,
        10,
        null,
      ],
      hat: true,
      kick: true,
      pad: false,
    },
  },

  music(name) {
    if (name === this._songName) return;
    this._songName = name;
    this._song = name ? this._songs[name] : null;
    this._step = 0;
    if (!this.ctx) return; // sẽ start khi ensure()
    this._startScheduler();
  },

  _startScheduler() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    if (!this._song) return;
    this._nextT = this.ctx.currentTime + 0.06;
    this._timer = setInterval(() => this._tick(), 30);
  },

  _midi(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  },

  _note(f, t, dur, type, g, slideTo) {
    const c = this.ctx;
    const o = c.createOscillator(),
      gn = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.linearRampToValueAtTime(slideTo, t + dur);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.linearRampToValueAtTime(g, t + 0.012);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn);
    gn.connect(this.musicBus);
    o.start(t);
    o.stop(t + dur + 0.03);
  },

  _drum(t, kind) {
    const c = this.ctx;
    if (kind === "kick") {
      const o = c.createOscillator(),
        gn = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.1);
      gn.gain.setValueAtTime(0.4, t);
      gn.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(gn);
      gn.connect(this.musicBus);
      o.start(t);
      o.stop(t + 0.14);
    } else {
      const src = c.createBufferSource();
      src.buffer = this._noiseBuf;
      src.loop = true;
      const flt = c.createBiquadFilter();
      flt.type = "highpass";
      flt.frequency.value = 6000;
      const gn = c.createGain();
      gn.gain.setValueAtTime(kind === "ohat" ? 0.09 : 0.05, t);
      gn.gain.exponentialRampToValueAtTime(
        0.001,
        t + (kind === "ohat" ? 0.12 : 0.04),
      );
      src.connect(flt);
      flt.connect(gn);
      gn.connect(this.musicBus);
      src.start(t);
      src.stop(t + 0.15);
    }
  },

  _tick() {
    const s = this._song;
    if (!s || !this.ctx) return;
    const spb = 60 / s.bpm; // giây / beat
    const step8 = spb / 2; // 8th note
    while (this._nextT < this.ctx.currentTime + 0.16) {
      const t = this._nextT,
        i = this._step;
      const bar = (i >> 3) % s.bars.length; // 8 x 8th mỗi bar
      const chord = s.bars[bar];
      const root = s.root;
      // bass: 8th notes root
      if (s.bassGain) {
        const bn = root - 12 + chord[0];
        if (i % 2 === 0 || s === this._songs.boss)
          this._note(this._midi(bn), t, step8 * 0.9, "triangle", s.bassGain);
      }
      // arp: chord tones mỗi 8th
      if (s.arpGain) {
        const tone = chord[(i * 2) % chord.length] + s.arpOct;
        this._note(
          this._midi(root + tone),
          t,
          step8 * 0.95,
          s.arpType,
          s.arpGain,
        );
        if (s.pad && i % 8 === 0) {
          for (const cn of chord)
            this._note(this._midi(root + cn), t, spb * 4, "sine", 0.05);
          this._note(
            this._midi(root + chord[1] + 24),
            t + step8,
            spb * 3,
            "sine",
            0.035,
          );
        }
      }
      // lead
      if (s.leadGain && s.lead.length) {
        const n = s.lead[i % s.lead.length];
        if (n !== null && n !== undefined)
          this._note(
            this._midi(root + n + 12),
            t,
            step8 * 0.92,
            s.leadType,
            s.leadGain,
          );
      }
      // drums
      if (s.kick && i % 4 === 0) this._drum(t, "kick");
      if (s.hat) this._drum(t + step8 / 2, i % 4 === 2 ? "ohat" : "hat");
      this._nextT += step8;
      this._step++;
    }
  },
};
