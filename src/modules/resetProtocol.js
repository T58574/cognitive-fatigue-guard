// Physiological Reset Protocol Engine
// Canvas Guided Breathwork (Physiological Sigh), Saccadic Eye Tracking, and Lockout Manager

import { audioEngine } from './audio.js';

export class PhysiologicalResetEngine {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.durationSeconds = options.durationSeconds || 180;
    this.onComplete = options.onComplete || (() => {});

    this.width = 0;
    this.height = 0;
    this.animFrameId = null;

    this.activePhase = 'BREATHWORK'; // 'BREATHWORK' | 'SACCADE_EYE' | 'POSTURE_CHECK'
    this.remainingSeconds = this.durationSeconds;
    this.timerIntervalId = null;

    // Breathwork State
    this.breathCycleState = 'INHALE1'; // 'INHALE1' | 'INHALE2' | 'EXHALE'
    this.breathProgress = 0; // 0 to 1
    this.breathPhaseStartTime = performance.now();

    // Saccade Target Position
    this.saccadeAngle = 0;

    this.resizeCanvas();
  }

  resizeCanvas() {
    const parent = this.canvas.parentElement;
    if (parent) {
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.width = rect.width;
      this.height = Math.min(rect.width * 0.7, 340);

      this.canvas.width = this.width * dpr;
      this.canvas.height = this.height * dpr;
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;

      this.ctx.scale(dpr, dpr);
    }
  }

  startProtocol() {
    this.resizeCanvas();
    this.remainingSeconds = this.durationSeconds;
    this.activePhase = 'BREATHWORK';
    this.breathCycleState = 'INHALE1';
    this.breathPhaseStartTime = performance.now();

    audioEngine.playBreathingGuide('inhale1');

    if (this.timerIntervalId) clearInterval(this.timerIntervalId);
    this.timerIntervalId = setInterval(() => {
      this.remainingSeconds--;
      if (this.remainingSeconds <= 0) {
        this.finishProtocol();
      }
    }, 1000);

    this.loop();
  }

  setPhase(phaseName) {
    this.activePhase = phaseName;
  }

  finishProtocol() {
    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    audioEngine.playSuccessChord();
    this.onComplete();
  }

  loop() {
    this.render();
    this.animFrameId = requestAnimationFrame(() => this.loop());
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const now = performance.now();

    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, w, h);

    if (this.activePhase === 'BREATHWORK') {
      this.renderBreathwork(ctx, w, h, now);
    } else if (this.activePhase === 'SACCADE_EYE') {
      this.renderSaccadeEye(ctx, w, h, now);
    } else if (this.activePhase === 'POSTURE_CHECK') {
      this.renderPostureCheck(ctx, w, h);
    }

    // Top Lock Timer
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ff0844';
    ctx.font = '700 14px monospace';
    const mins = Math.floor(this.remainingSeconds / 60);
    const secs = String(this.remainingSeconds % 60).padStart(2, '0');
    ctx.fillText(`LOCK TIMER: ${mins}:${secs}`, w - 15, 15);
  }

  renderBreathwork(ctx, w, h, now) {
    const phaseElapsed = (now - this.breathPhaseStartTime) / 1000;

    // Physiological Sigh Timings
    const tInhale1 = 1.4;
    const tInhale2 = 0.7;
    const tExhale = 3.6;

    let targetRadius = 40;
    let label = 'FIRST INHALE (NOSE)';

    if (this.breathCycleState === 'INHALE1') {
      const progress = Math.min(1, phaseElapsed / tInhale1);
      targetRadius = 40 + progress * 45;
      label = '1. DEEP INHALE (NOSE)';
      if (progress >= 1) {
        this.breathCycleState = 'INHALE2';
        this.breathPhaseStartTime = now;
        audioEngine.playBreathingGuide('inhale2');
      }

    } else if (this.breathCycleState === 'INHALE2') {
      const progress = Math.min(1, phaseElapsed / tInhale2);
      targetRadius = 85 + progress * 25;
      label = '2. QUICK SECOND TOP-OFF INHALE';
      if (progress >= 1) {
        this.breathCycleState = 'EXHALE';
        this.breathPhaseStartTime = now;
        audioEngine.playBreathingGuide('exhale');
      }

    } else if (this.breathCycleState === 'EXHALE') {
      const progress = Math.min(1, phaseElapsed / tExhale);
      targetRadius = 110 - progress * 70;
      label = '3. SLOW LONG EXHALE (MOUTH)';
      if (progress >= 1) {
        this.breathCycleState = 'INHALE1';
        this.breathPhaseStartTime = now;
        audioEngine.playBreathingGuide('inhale1');
      }
    }

    // Concentric Breath Rings
    ctx.save();
    ctx.shadowColor = '#00f2fe';
    ctx.shadowBlur = 30;

    const grad = ctx.createRadialGradient(w / 2, h / 2, 5, w / 2, h / 2, targetRadius);
    grad.addColorStop(0, 'rgba(0, 242, 254, 0.8)');
    grad.addColorStop(1, 'rgba(79, 172, 254, 0.1)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, targetRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // Guidance text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 18px system-ui, sans-serif';
    ctx.fillText(label, w / 2, h / 2);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillText('PHYSIOLOGICAL SIGH (NEURAL PARASYMPATHETIC RESET)', w / 2, h - 35);
  }

  renderSaccadeEye(ctx, w, h, now) {
    this.saccadeAngle += 0.02;

    const radiusX = w * 0.35;
    const radiusY = h * 0.28;
    const x = w / 2 + Math.cos(this.saccadeAngle) * radiusX;
    const y = h / 2 + Math.sin(this.saccadeAngle * 2) * radiusY * 0.5; // Figure-8 infinity path

    // Draw Infinity Track
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let t = 0; t < Math.PI * 2; t += 0.05) {
      const tx = w / 2 + Math.cos(t) * radiusX;
      const ty = h / 2 + Math.sin(t * 2) * radiusY * 0.5;
      if (t === 0) ctx.moveTo(tx, ty);
      else ctx.lineTo(tx, ty);
    }
    ctx.stroke();

    // Moving Saccade Target
    ctx.save();
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillText('FOLLOW THE GREEN TARGET WITH EYES ONLY (NO HEAD MOVEMENT)', w / 2, 40);
    ctx.fillStyle = '#64748b';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('Relieves optic nerve & visual cortex fatigue (20-20-20 rule)', w / 2, 62);
  }

  renderPostureCheck(ctx, w, h) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#38bdf8';
    ctx.font = '800 20px system-ui, sans-serif';
    ctx.fillText('PHYSICAL SOMATIC ALIGNMENT', w / 2, 45);

    const items = [
      '1. 💧 Drink 250ml of clean room-temperature water',
      '2. 💆 Release jaw tension & drop shoulders away from ears',
      '3. 🧘 Extend cervical spine and align neck over chest',
      '4. 👁️ Soft gaze into distance (unfocus peripheral vision)'
    ];

    items.forEach((item, idx) => {
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '600 14px system-ui, sans-serif';
      ctx.fillText(item, w / 2, 95 + idx * 38);
    });
  }
}
