// Physiological Reset Protocol Engine - Soothing Dark Pastel Zen Design

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

    this.breathCycleState = 'INHALE1';
    this.breathPhaseStartTime = performance.now();
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

    ctx.fillStyle = '#10141d';
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
    ctx.fillStyle = '#81b29a';
    ctx.font = '600 13px monospace';
    const mins = Math.floor(this.remainingSeconds / 60);
    const secs = String(this.remainingSeconds % 60).padStart(2, '0');
    ctx.fillText(`Отдых: ${mins}:${secs}`, w - 15, 15);
  }

  renderBreathwork(ctx, w, h, now) {
    const phaseElapsed = (now - this.breathPhaseStartTime) / 1000;

    const tInhale1 = 1.4;
    const tInhale2 = 0.7;
    const tExhale = 3.6;

    let targetRadius = 40;
    let label = '1. Глубокий вдох (носом)';

    if (this.breathCycleState === 'INHALE1') {
      const progress = Math.min(1, phaseElapsed / tInhale1);
      targetRadius = 40 + progress * 45;
      label = '1. Глубокий вдох (носом)';
      if (progress >= 1) {
        this.breathCycleState = 'INHALE2';
        this.breathPhaseStartTime = now;
        audioEngine.playBreathingGuide('inhale2');
      }

    } else if (this.breathCycleState === 'INHALE2') {
      const progress = Math.min(1, phaseElapsed / tInhale2);
      targetRadius = 85 + progress * 25;
      label = '2. Короткий до-вдох';
      if (progress >= 1) {
        this.breathCycleState = 'EXHALE';
        this.breathPhaseStartTime = now;
        audioEngine.playBreathingGuide('exhale');
      }

    } else if (this.breathCycleState === 'EXHALE') {
      const progress = Math.min(1, phaseElapsed / tExhale);
      targetRadius = 110 - progress * 70;
      label = '3. Медленный длинный выдох (ртом)';
      if (progress >= 1) {
        this.breathCycleState = 'INHALE1';
        this.breathPhaseStartTime = now;
        audioEngine.playBreathingGuide('inhale1');
      }
    }

    // Concentric Breath Circles in Pastel Sage
    const grad = ctx.createRadialGradient(w / 2, h / 2, 5, w / 2, h / 2, targetRadius);
    grad.addColorStop(0, 'rgba(129, 178, 154, 0.4)');
    grad.addColorStop(1, 'rgba(129, 178, 154, 0.05)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, targetRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#81b29a';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f4f1de';
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.fillText(label, w / 2, h / 2);

    ctx.fillStyle = '#9bb1c9';
    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillText('Physiological Sigh (Сброс напряжения нервной системы)', w / 2, h - 30);
  }

  renderSaccadeEye(ctx, w, h, now) {
    this.saccadeAngle += 0.018;

    const radiusX = w * 0.35;
    const radiusY = h * 0.28;
    const x = w / 2 + Math.cos(this.saccadeAngle) * radiusX;
    const y = h / 2 + Math.sin(this.saccadeAngle * 2) * radiusY * 0.5;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let t = 0; t < Math.PI * 2; t += 0.05) {
      const tx = w / 2 + Math.cos(t) * radiusX;
      const ty = h / 2 + Math.sin(t * 2) * radiusY * 0.5;
      if (t === 0) ctx.moveTo(tx, ty);
      else ctx.lineTo(tx, ty);
    }
    ctx.stroke();

    ctx.fillStyle = '#81b29a';
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f4f1de';
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillText('Следите за кругом только глазами (не двигайте головой)', w / 2, 40);
    ctx.fillStyle = '#9bb1c9';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('Снимает спазм аккомодации и расслабляет зрительный отдел', w / 2, 60);
  }

  renderPostureCheck(ctx, w, h) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#81b29a';
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillText('Физическое расслабление тела', w / 2, 45);

    const items = [
      '1. 💧 Сделайте пару глотков чистой воды',
      '2. 💆 Опустите плечи и расслабьте сжатые челюсти',
      '3. 🧘 Выпрямите шейный отдел позвоночника',
      '4. 👁️ Расфокусируйте взгляд вдали на несколько секунд'
    ];

    items.forEach((item, idx) => {
      ctx.fillStyle = '#f4f1de';
      ctx.font = '500 14px system-ui, sans-serif';
      ctx.fillText(item, w / 2, 95 + idx * 38);
    });
  }
}
