// 24-Hour Circadian Fatigue Risk Heatmap Engine

export class CircadianHeatmapEngine {
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
      this.height = Math.min(rect.width * 0.45, 220);

      this.canvas.width = this.width * dpr;
      this.canvas.height = this.height * dpr;
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;

      this.ctx.scale(dpr, dpr);
    }
  }

  render(history = []) {
    this.resize();
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(0, 0, w, h);

    // Group tests by hour (0 to 23)
    const hourlyData = Array(24).fill(null).map(() => ({ totalScore: 0, count: 0, avg: 0 }));

    history.forEach(item => {
      const hour = new Date(item.timestamp).getHours();
      hourlyData[hour].totalScore += item.fatigueScore;
      hourlyData[hour].count += 1;
    });

    hourlyData.forEach(hd => {
      if (hd.count > 0) hd.avg = Math.round(hd.totalScore / hd.count);
    });

    const padding = { top: 35, right: 20, bottom: 35, left: 35 };
    const barWidth = (w - padding.left - padding.right) / 24;
    const chartH = h - padding.top - padding.bottom;

    // Header
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText('24-HOUR CIRCADIAN FATIGUE HEATMAP (HOURLY RISK)', padding.left, 10);

    const currentHour = new Date().getHours();

    for (let hr = 0; hr < 24; hr++) {
      const data = hourlyData[hr];
      const x = padding.left + hr * barWidth;
      const barH = data.count > 0 ? (data.avg / 100) * chartH : 10;
      const y = padding.top + chartH - barH;

      // Color coding based on average fatigue index
      let color = 'rgba(16, 185, 129, 0.6)'; // Green
      if (data.count === 0) {
        color = 'rgba(255, 255, 255, 0.05)';
      } else if (data.avg >= 30) {
        color = 'rgba(255, 8, 68, 0.8)'; // Red
      } else if (data.avg >= 15) {
        color = 'rgba(245, 158, 11, 0.7)'; // Yellow
      }

      ctx.fillStyle = color;
      ctx.fillRect(x + 2, y, barWidth - 4, barH);

      // Highlight current hour
      if (hr === currentHour) {
        ctx.strokeStyle = '#00f2fe';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, padding.top, barWidth - 2, chartH);

        ctx.fillStyle = '#00f2fe';
        ctx.font = '800 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('NOW', x + barWidth / 2, padding.top - 12);
      }

      // Hour Labels (Every 3 hours)
      if (hr % 3 === 0) {
        ctx.fillStyle = '#64748b';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${hr}:00`, x + barWidth / 2, h - 20);
      }
    }
  }
}
