// HTML5 Canvas Psychomotor Vigilance Task (PVT-Micro) & Go/No-Go Reaction Engine

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

    // Test State
    this.state = 'IDLE'; // 'IDLE' | 'WAITING' | 'STIMULUS_GO' | 'STIMULUS_NOGO' | 'FEEDBACK' | 'FINISHED'
    this.trials = [];
    this.currentTrialIndex = 0;
    this.maxDurationSeconds = 15;
    this.startTime = 0;
    this.stimulusStartTime = 0;
    this.stimulusTimeoutId = null;
    this.feedbackText = '';
    this.feedbackColor = '#00f2fe';
    this.feedbackEndTime = 0;

    // Active trial data
    this.currentIsGo = true;

    // Results tracking
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
      this.height = Math.min(rect.width * 0.7, 360);

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
    const randomDelay = 1100 + Math.random() * 1700;

    this.stimulusTimeoutId = setTimeout(() => {
      this.currentIsGo = Math.random() > 0.22;
      this.state = this.currentIsGo ? 'STIMULUS_GO' : 'STIMULUS_NOGO';
      this.stimulusStartTime = performance.now();

      if (!this.currentIsGo) {
        this.stimulusTimeoutId = setTimeout(() => {
          if (this.state === 'STIMULUS_NOGO') {
            audioEngine.playClickPing();
            this.showFeedback('GOOD REFLEX! (DECOY IGNORED)', '#10b981');
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
      this.showFeedback('FALSE START! WAIT FOR SIGNAL', '#ff0844');
      setTimeout(() => this.scheduleNextTrial(), 700);

    } else if (this.state === 'STIMULUS_GO') {
      const rt = Math.round(now - this.stimulusStartTime);
      this.reactionTimes.push(rt);

      if (rt > 420) {
        this.lapses++;
        audioEngine.playErrorTone();
        this.showFeedback(`${rt} ms - ATTENTIONAL LAPSE!`, '#f59e0b');
      } else {
        audioEngine.playClickPing();
        this.showFeedback(`${rt} ms`, '#00f2fe');
      }

      this.currentTrialIndex++;
      setTimeout(() => this.scheduleNextTrial(), 400);

    } else if (this.state === 'STIMULUS_NOGO') {
      if (this.stimulusTimeoutId) clearTimeout(this.stimulusTimeoutId);
      this.falseStarts++;
      audioEngine.playErrorTone();
      this.showFeedback('DECOY CLICKED! (NO-GO ERROR)', '#ff0844');
      setTimeout(() => this.scheduleNextTrial(), 700);
    }
  }

  showFeedback(text, color) {
    this.state = 'FEEDBACK';
    this.feedbackText = text;
    this.feedbackColor = color;
    this.feedbackEndTime = performance.now() + 350;
  }

  finishTest() {
    this.stopTest();
    this.state = 'FINISHED';

    const medianRT = calculateMedian(this.reactionTimes) || 500;
    const rtvSD = calculateStandardDeviation(this.reactionTimes) || 100;
    const meanRT = this.reactionTimes.length > 0
      ? Math.round(this.reactionTimes.reduce((a, b) => a + b, 0) / this.reactionTimes.length)
      : 500;

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

    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
    ctx.lineWidth = 1;
    const step = 30;
    for (let x = 0; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const elapsedSec = Math.min(this.maxDurationSeconds, (now - this.startTime) / 1000);
    const progressPerc = elapsedSec / this.maxDurationSeconds;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(0, 0, w, 6);
    ctx.fillStyle = '#00f2fe';
    ctx.fillRect(0, 0, w * progressPerc, 6);

    if (this.state === 'WAITING') {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const pulse = (Math.sin(now / 150) + 1) / 2;
      ctx.strokeStyle = `rgba(0, 242, 254, ${0.3 + pulse * 0.4})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 45 + pulse * 10, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 16px system-ui, sans-serif';
      ctx.fillText('STAY FOCUSED...', w / 2, h / 2 - 10);
      ctx.fillStyle = '#64748b';
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText('TAP IMMEDIATELY WHEN NEON SIGNAL APPEARS', w / 2, h / 2 + 15);

    } else if (this.state === 'STIMULUS_GO') {
      const stimulusDuration = Math.round(now - this.stimulusStartTime);
      ctx.save();
      ctx.shadowColor = '#00f2fe';
      ctx.shadowBlur = 25;
      ctx.fillStyle = '#00f2fe';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 70, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#04070d';
      ctx.font = '800 32px monospace';
      ctx.fillText(`${stimulusDuration} ms`, w / 2, h / 2 - 4);
      ctx.fillStyle = '#04070d';
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.fillText('TAP NOW!', w / 2, h / 2 + 22);

    } else if (this.state === 'STIMULUS_NOGO') {
      ctx.save();
      ctx.shadowColor = '#ff0844';
      ctx.shadowBlur = 30;
      ctx.fillStyle = '#ff0844';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 28px system-ui, sans-serif';
      ctx.fillText('⚠️ DECOY', w / 2, h / 2 - 6);
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.fillText('DO NOT TAP!', w / 2, h / 2 + 20);

    } else if (this.state === 'FEEDBACK') {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = this.feedbackColor;
      ctx.font = '800 24px system-ui, sans-serif';
      ctx.fillText(this.feedbackText, w / 2, h / 2);
    }
  }

  drawFinishedState(results) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const color = results.status === 'OPTIMAL' ? '#10b981' : results.status === 'MILD' ? '#f59e0b' : '#ff0844';

    ctx.fillStyle = color;
    ctx.font = '900 26px system-ui, sans-serif';
    ctx.fillText(`TEST COMPLETE: ${results.status}`, w / 2, 45);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 36px monospace';
    ctx.fillText(`${results.medianRT} ms`, w / 2, 105);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`Median Reaction Latency | RTV Variability: ±${results.rtvSD} ms`, w / 2, 140);
    ctx.fillText(`Lapses: ${results.lapses} | False Starts: ${results.falseStarts} | Degradation Score: ${results.fatigueScore}%`, w / 2, 168);

    if (results.status === 'DEGRADED') {
      ctx.fillStyle = '#ff0844';
      ctx.font = '700 14px system-ui, sans-serif';
      ctx.fillText('🚨 HARD LOCKOUT ENGAGED - REST PROTOCOL REQUIRED', w / 2, h - 35);
    }
  }
}
