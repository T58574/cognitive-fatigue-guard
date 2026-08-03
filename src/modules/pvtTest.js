// HTML5 Canvas Psychomotor Vigilance Task (PVT-Micro) Engine - Soft Pastel Zen Design

import { audioEngine } from './audio.js';
import { calculateMedian, calculateStandardDeviation, computeFatigueScore, evaluateCnsStatus } from './biometrics.js';

export class CanvasPVTTestEngine {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.onComplete = options.onComplete || (() => {});
    this.baseline = options.baseline || { baselineMedianRT: 260, baselineRTV: 35 };

    this.width = 0;
    this.height = 0;
    this.animFrameId = null;

    this.state = 'IDLE';
    this.currentTrialIndex = 0;
    this.maxDurationSeconds = 15;
    this.startTime = 0;
    this.stimulusStartTime = 0;
    this.stimulusTimeoutId = null;
    this.feedbackText = '';
    this.feedbackColor = '#81b29a';

    this.currentIsGo = true;
    this.reactionTimes = [];
    this.falseStarts = 0;
    this.lapses = 0;

    this.boundHandleInput = this.handleInput.bind(this);
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

  startTest() {
    this.resizeCanvas();
    this.reactionTimes = [];
    this.falseStarts = 0;
    this.lapses = 0;
    this.currentTrialIndex = 0;
    this.startTime = performance.now();
    this.state = 'WAITING';

    this.canvas.removeEventListener('pointerdown', this.boundHandleInput);
    this.canvas.addEventListener('pointerdown', this.boundHandleInput);

    this.scheduleNextTrial();
    this.loop();
  }

  stopTest() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.stimulusTimeoutId) {
      clearTimeout(this.stimulusTimeoutId);
      this.stimulusTimeoutId = null;
    }
    this.canvas.removeEventListener('pointerdown', this.boundHandleInput);
    this.state = 'IDLE';
  }

  scheduleNextTrial() {
    const elapsedSeconds = (performance.now() - this.startTime) / 1000;
    if (elapsedSeconds >= this.maxDurationSeconds && this.reactionTimes.length >= 3) {
      this.finishTest();
      return;
    }

    this.state = 'WAITING';
    const randomDelay = 1200 + Math.random() * 1600;

    this.stimulusTimeoutId = setTimeout(() => {
      this.currentIsGo = Math.random() > 0.2;
      this.state = this.currentIsGo ? 'STIMULUS_GO' : 'STIMULUS_NOGO';
      this.stimulusStartTime = performance.now();

      if (!this.currentIsGo) {
        this.stimulusTimeoutId = setTimeout(() => {
          if (this.state === 'STIMULUS_NOGO') {
            audioEngine.playClickPing();
            this.showFeedback('Мимо ложной цели ✓', '#81b29a');
            setTimeout(() => this.scheduleNextTrial(), 400);
          }
        }, 1000);
      }
    }, randomDelay);
  }

  handleInput(e) {
    e.preventDefault();
    const now = performance.now();

    if (this.state === 'WAITING') {
      if (this.stimulusTimeoutId) clearTimeout(this.stimulusTimeoutId);
      this.falseStarts++;
      audioEngine.playErrorTone();
      this.showFeedback('Преждевременное нажатие', '#e07a5f');
      setTimeout(() => this.scheduleNextTrial(), 700);

    } else if (this.state === 'STIMULUS_GO') {
      const rt = Math.round(now - this.stimulusStartTime);
      this.reactionTimes.push(rt);

      if (rt > 420) {
        this.lapses++;
        audioEngine.playErrorTone();
        this.showFeedback(`${rt} мс — Внимание снижено`, '#e07a5f');
      } else {
        audioEngine.playClickPing();
        this.showFeedback(`${rt} мс`, '#81b29a');
      }

      this.currentTrialIndex++;
      setTimeout(() => this.scheduleNextTrial(), 400);

    } else if (this.state === 'STIMULUS_NOGO') {
      if (this.stimulusTimeoutId) clearTimeout(this.stimulusTimeoutId);
      this.falseStarts++;
      audioEngine.playErrorTone();
      this.showFeedback('Ложная цель нажата', '#e07a5f');
      setTimeout(() => this.scheduleNextTrial(), 700);
    }
  }

  showFeedback(text, color) {
    this.state = 'FEEDBACK';
    this.feedbackText = text;
    this.feedbackColor = color;
  }

  finishTest() {
    this.stopTest();
    this.state = 'FINISHED';

    const medianRT = calculateMedian(this.reactionTimes) || 260;
    const rtvSD = calculateStandardDeviation(this.reactionTimes) || 35;
    const meanRT = this.reactionTimes.length > 0
      ? Math.round(this.reactionTimes.reduce((a, b) => a + b, 0) / this.reactionTimes.length)
      : 260;

    const baseMed = this.baseline.baselineMedianRT || 260;
    const baseRTV = this.baseline.baselineRTV || 35;

    const fatigueScore = computeFatigueScore({
      medianRT,
      rtvSD,
      lapses: this.lapses,
      falseStarts: this.falseStarts,
      baselineMedianRT: baseMed,
      baselineRTV: baseRTV
    });

    const status = evaluateCnsStatus(fatigueScore, this.lapses, medianRT, baseMed);

    if (status === 'DEGRADED') {
      audioEngine.playLockdownAlert();
    } else {
      audioEngine.playSuccessChord();
    }

    const results = {
      reactionTimes: this.reactionTimes,
      medianRT,
      meanRT,
      rtvSD,
      lapses: this.lapses,
      falseStarts: this.falseStarts,
      fatigueScore,
      status
    };

    this.drawFinishedState(results);
    this.onComplete(results);
  }

  loop() {
    if (this.state === 'IDLE') return;
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

    const elapsedSec = Math.min(this.maxDurationSeconds, (now - this.startTime) / 1000);
    const progressPerc = elapsedSec / this.maxDurationSeconds;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(0, 0, w, 4);
    ctx.fillStyle = '#81b29a';
    ctx.fillRect(0, 0, w * progressPerc, 4);

    if (this.state === 'WAITING') {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const pulse = (Math.sin(now / 200) + 1) / 2;
      ctx.strokeStyle = `rgba(129, 178, 154, ${0.2 + pulse * 0.3})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 45 + pulse * 8, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#9bb1c9';
      ctx.font = '600 15px system-ui, sans-serif';
      ctx.fillText('Сфокусируйтесь...', w / 2, h / 2 - 10);
      ctx.fillStyle = '#64748b';
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText('Нажмите при появлении зеленого круга', w / 2, h / 2 + 15);

    } else if (this.state === 'STIMULUS_GO') {
      const stimulusDuration = Math.round(now - this.stimulusStartTime);

      ctx.fillStyle = '#81b29a';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 65, 0, Math.PI * 2);
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#141923';
      ctx.font = '700 28px monospace';
      ctx.fillText(`${stimulusDuration} мс`, w / 2, h / 2 - 2);

    } else if (this.state === 'STIMULUS_NOGO') {
      ctx.fillStyle = '#e07a5f';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 65, 0, Math.PI * 2);
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 22px system-ui, sans-serif';
      ctx.fillText('Не нажимать', w / 2, h / 2);

    } else if (this.state === 'FEEDBACK') {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = this.feedbackColor;
      ctx.font = '700 22px system-ui, sans-serif';
      ctx.fillText(this.feedbackText, w / 2, h / 2);
    }
  }

  drawFinishedState(results) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.fillStyle = '#10141d';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const color = results.status === 'OPTIMAL' ? '#81b29a' : '#e07a5f';
    const statusText = results.status === 'OPTIMAL' ? 'Замер пройден: Отлично' : 'Замер пройден: Нужен отдых';

    ctx.fillStyle = color;
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillText(statusText, w / 2, 50);

    ctx.fillStyle = '#f4f1de';
    ctx.font = '700 32px monospace';
    ctx.fillText(`${results.medianRT} мс`, w / 2, 110);

    ctx.fillStyle = '#9bb1c9';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`Медиана реакции | Разброс RTV: ±${results.rtvSD} мс`, w / 2, 150);
  }
}
