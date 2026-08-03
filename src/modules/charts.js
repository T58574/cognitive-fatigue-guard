// HTML5 Canvas Dynamic Fatigue Analytics & Trend Chart Renderer

export class CanvasFatigueChartEngine {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.resize();
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (parent) {
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.width = rect.width;
      this.height = Math.min(rect.width * 0.55, 300);

      this.canvas.width = this.width * dpr;
      this.canvas.height = this.height * dpr;
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;

      this.ctx.scale(dpr, dpr);
    }
  }

  renderTrends(history = [], baselineMedian = 260) {
    this.resize();
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(0, 0, w, h);

    const padding = { top: 40, right: 30, bottom: 45, left: 50 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    if (history.length === 0) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#64748b';
      ctx.font = '600 14px system-ui, sans-serif';
      ctx.fillText('NO TEST DATA RECORDED YET. RUN YOUR FIRST 15s CHECK-IN.', w / 2, h / 2);
      return;
    }

    // Sort ascending by time
    const data = [...history].sort((a, b) => a.timestamp - b.timestamp).slice(-20);

    // Determine Y axis range (Median RT in ms)
    const rtValues = data.map(d => d.medianRT);
    const minRT = Math.max(150, Math.min(...rtValues, baselineMedian - 40) - 20);
    const maxRT = Math.max(450, Math.max(...rtValues, baselineMedian + 100) + 30);

    // Y Grid lines & Labels
    const gridCount = 4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#64748b';
    ctx.font = '11px monospace';

    for (let i = 0; i <= gridCount; i++) {
      const yVal = minRT + ((maxRT - minRT) / gridCount) * i;
      const yPos = padding.top + chartH - (i / gridCount) * chartH;

      ctx.beginPath();
      ctx.moveTo(padding.left, yPos);
      ctx.lineTo(w - padding.right, yPos);
      ctx.stroke();

      ctx.fillText(`${Math.round(yVal)}ms`, padding.left - 8, yPos);
    }

    // Baseline Line
    const baselineY = padding.top + chartH - ((baselineMedian - minRT) / (maxRT - minRT)) * chartH;
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.5)';
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padding.left, baselineY);
    ctx.lineTo(w - padding.right, baselineY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#00f2fe';
    ctx.textAlign = 'left';
    ctx.font = '10px monospace';
    ctx.fillText(`BASELINE (${baselineMedian}ms)`, padding.left + 5, baselineY - 8);

    // Draw Data Line & Points
    const points = data.map((item, idx) => {
      const x = padding.left + (idx / Math.max(1, data.length - 1)) * chartW;
      const y = padding.top + chartH - ((item.medianRT - minRT) / (maxRT - minRT)) * chartH;
      return { x, y, item };
    });

    // Draw Area under line
    const areaGrad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    areaGrad.addColorStop(0, 'rgba(79, 172, 254, 0.35)');
    areaGrad.addColorStop(1, 'rgba(79, 172, 254, 0.0)');

    ctx.fillStyle = areaGrad;
    ctx.beginPath();
    ctx.moveTo(points[0].x, padding.top + chartH);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
    ctx.closePath();
    ctx.fill();

    // Draw Smooth Line
    ctx.strokeStyle = '#4facfe';
    ctx.lineWidth = 3;
    ctx.beginPath();
    points.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    // Draw Point Circles
    points.forEach((p) => {
      const isDegraded = p.item.status === 'DEGRADED';
      const color = isDegraded ? '#ff0844' : p.item.status === 'MILD' ? '#f59e0b' : '#10b981';

      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, isDegraded ? 7 : 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    });

    // Chart Title
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText('CNS REACTION TIME DYNAMICS (LAST 20 RUNS)', padding.left, 12);
  }
}
