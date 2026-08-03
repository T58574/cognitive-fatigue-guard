// Main Application Controller - Cognitive Fatigue Guard

import { audioEngine } from './modules/audio.js';
import { biometricStorage } from './modules/storage.js';
import { notificationService } from './modules/notifications.js';
import { CanvasPVTTestEngine } from './modules/pvtTest.js';
import { PhysiologicalResetEngine } from './modules/resetProtocol.js';
import { CanvasFatigueChartEngine } from './modules/charts.js';

class AppController {
  constructor() {
    this.deferredInstallPrompt = null;
    this.settings = null;
    this.baseline = null;

    // Engines
    this.pvtEngine = null;
    this.resetEngine = null;
    this.lockoutResetEngine = null;
    this.chartEngine = null;

    // Timer state
    this.checkinTimerId = null;
    this.nextCheckinTimestamp = Date.now() + 120 * 60 * 1000;
  }

  async init() {
    // 1. Load Settings & Baseline
    this.settings = await biometricStorage.getSettings();
    this.baseline = await biometricStorage.computeBaseline();

    // 2. Register Service Worker
    this.registerServiceWorker();

    // 3. Setup UI Event Listeners
    this.setupNavigation();
    this.setupPWAInstaller();
    this.setupAudioAndNotifications();
    this.setupSettingsForm();
    this.setupDataExportAndWipe();

    // 4. Initialize Canvas Engines
    this.initEngines();

    // 5. Update UI Dashboard
    await this.refreshDashboard();

    // 6. Start 2-Hour Check-in Countdown
    this.startCheckinTimer();

    // 7. Request Notification Permission
    notificationService.requestPermission();
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(() => console.log('Service Worker registered successfully.'))
        .catch((err) => console.error('Service worker registration failed:', err));
    }
  }

  setupPWAInstaller() {
    const banner = document.getElementById('pwaBanner');
    const installBtn = document.getElementById('btnInstallPWA');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
      if (banner) banner.style.display = 'flex';
    });

    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        if (this.deferredInstallPrompt) {
          this.deferredInstallPrompt.prompt();
          const choice = await this.deferredInstallPrompt.userChoice;
          if (choice.outcome === 'accepted') {
            if (banner) banner.style.display = 'none';
          }
          this.deferredInstallPrompt = null;
        }
      });
    }
  }

  setupAudioAndNotifications() {
    const audioBtn = document.getElementById('btnAudioToggle');
    const initBtn = document.getElementById('btnInitAudio');
    const audioIcon = document.getElementById('audioIcon');
    const audioLabel = document.getElementById('audioLabel');

    const updateAudioUI = () => {
      if (audioEngine.isMuted) {
        if (audioIcon) audioIcon.textContent = '0️⃣';
        if (audioLabel) audioLabel.textContent = 'Sound OFF';
      } else {
        if (audioIcon) audioIcon.textContent = '🔊';
        if (audioLabel) audioLabel.textContent = 'Sound ON';
      }
    };

    if (audioBtn) {
      audioBtn.addEventListener('click', () => {
        audioEngine.setMuted(!audioEngine.isMuted);
        updateAudioUI();
      });
    }

    if (initBtn) {
      initBtn.addEventListener('click', () => {
        audioEngine.init();
        audioEngine.playClickPing();
        initBtn.style.display = 'none';
      });
    }
  }

  setupNavigation() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');

        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.style.display = 'none');

        btn.classList.add('active');
        const content = document.getElementById(targetTab);
        if (content) content.style.display = 'block';

        if (targetTab === 'tab-history') {
          this.renderChartAndHistory();
        } else if (targetTab === 'tab-protocol') {
          if (this.resetEngine) this.resetEngine.startProtocol();
        }
      });
    });

    // Quick Action buttons on Dashboard
    document.getElementById('btnQuickTest')?.addEventListener('click', () => {
      this.switchTab('tab-test');
      this.startReactionTest();
    });

    document.getElementById('btnQuickReset')?.addEventListener('click', () => {
      this.switchTab('tab-protocol');
      if (this.resetEngine) this.resetEngine.startProtocol();
    });

    document.getElementById('btnStartTestTab')?.addEventListener('click', () => {
      this.startReactionTest();
    });

    // Protocol phase switching buttons
    document.querySelectorAll('.phase-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.phase-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const phase = btn.getAttribute('data-phase');
        if (this.resetEngine) this.resetEngine.setPhase(phase);
      });
    });
  }

  switchTab(tabId) {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === tabId);
    });

    tabContents.forEach(c => {
      c.style.display = c.id === tabId ? 'block' : 'none';
    });

    if (tabId === 'tab-history') {
      this.renderChartAndHistory();
    }
  }

  initEngines() {
    const pvtCanvas = document.getElementById('pvtCanvas');
    if (pvtCanvas) {
      this.pvtEngine = new CanvasPVTTestEngine(pvtCanvas, {
        baseline: this.baseline,
        onComplete: (results) => this.handleTestCompleted(results)
      });
    }

    const resetCanvas = document.getElementById('resetCanvas');
    if (resetCanvas) {
      this.resetEngine = new PhysiologicalResetEngine(resetCanvas, {
        durationSeconds: this.settings.resetDurationSeconds,
        onComplete: () => {
          console.log('Manual protocol reset completed.');
        }
      });
    }

    const chartCanvas = document.getElementById('chartCanvas');
    if (chartCanvas) {
      this.chartEngine = new CanvasFatigueChartEngine(chartCanvas);
    }
  }

  startReactionTest() {
    if (this.pvtEngine) {
      this.pvtEngine.baseline = this.baseline;
      this.pvtEngine.startTest();
    }
  }

  async handleTestCompleted(results) {
    // 1. Save to DB
    await biometricStorage.saveTestRun(results);

    // 2. Recompute Baseline
    this.baseline = await biometricStorage.computeBaseline();

    // 3. Refresh Dashboard & Reset Timer
    await this.refreshDashboard();
    this.resetCheckinTimer();

    // 4. Trigger Strict Lockout Modal if DEGRADED
    if (results.status === 'DEGRADED' && this.settings.strictLockout) {
      this.triggerHardLockout(results);
    }
  }

  triggerHardLockout(results) {
    notificationService.sendLockoutAlert(results.fatigueScore);

    const modal = document.getElementById('modalLockout');
    const lockoutCanvas = document.getElementById('lockoutCanvas');
    const dismissBtn = document.getElementById('btnDismissLockout');

    if (modal && lockoutCanvas) {
      modal.style.display = 'flex';
      dismissBtn.style.display = 'none';

      this.lockoutResetEngine = new PhysiologicalResetEngine(lockoutCanvas, {
        durationSeconds: this.settings.resetDurationSeconds,
        onComplete: () => {
          dismissBtn.style.display = 'inline-block';
        }
      });
      this.lockoutResetEngine.startProtocol();
    }

    if (dismissBtn) {
      dismissBtn.onclick = () => {
        if (modal) modal.style.display = 'none';
        if (this.lockoutResetEngine) this.lockoutResetEngine.finishProtocol();
      };
    }
  }

  async refreshDashboard() {
    const history = await biometricStorage.getHistory(1);
    const lastRun = history[0];

    const badge = document.getElementById('badgeCnsStatus');
    const scoreVal = document.getElementById('valCnsScore');
    const medianVal = document.getElementById('valMedianRT');
    const rtvVal = document.getElementById('valRtvSD');
    const baseRTLbl = document.getElementById('lblBaselineRT');
    const baseRTVLbl = document.getElementById('lblBaselineRTV');
    const intervalLbl = document.getElementById('lblIntervalSetting');

    if (baseRTLbl) baseRTLbl.textContent = this.baseline.baselineMedianRT;
    if (baseRTVLbl) baseRTVLbl.textContent = `±${this.baseline.baselineRTV}`;
    if (intervalLbl) intervalLbl.textContent = `${this.settings.intervalMinutes / 60} Hours`;

    if (lastRun) {
      if (scoreVal) scoreVal.textContent = `${lastRun.fatigueScore}%`;
      if (medianVal) medianVal.textContent = `${lastRun.medianRT} ms`;
      if (rtvVal) rtvVal.textContent = `±${lastRun.rtvSD} ms`;

      if (badge) {
        badge.className = 'status-badge';
        if (lastRun.status === 'OPTIMAL') {
          badge.classList.add('status-optimal');
          badge.textContent = 'OPTIMAL';
        } else if (lastRun.status === 'MILD') {
          badge.classList.add('status-mild');
          badge.textContent = 'MILD FATIGUE';
        } else {
          badge.classList.add('status-degraded');
          badge.textContent = 'DEGRADED';
        }
      }
    }
  }

  startCheckinTimer() {
    const intervalMs = this.settings.intervalMinutes * 60 * 1000;
    this.nextCheckinTimestamp = Date.now() + intervalMs;

    if (this.checkinTimerId) clearInterval(this.checkinTimerId);

    this.checkinTimerId = setInterval(() => {
      const remainingMs = Math.max(0, this.nextCheckinTimestamp - Date.now());
      const valDisplay = document.getElementById('valNextCheckin');

      if (valDisplay) {
        const hrs = String(Math.floor(remainingMs / (1000 * 60 * 60))).padStart(2, '0');
        const mins = String(Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
        const secs = String(Math.floor((remainingMs % (1000 * 60)) / 1000)).padStart(2, '0');
        valDisplay.textContent = `${hrs}:${mins}:${secs}`;
      }

      if (remainingMs <= 0) {
        this.trigger2HourCheckinAlert();
        this.resetCheckinTimer();
      }
    }, 1000);
  }

  resetCheckinTimer() {
    this.startCheckinTimer();
  }

  trigger2HourCheckinAlert() {
    notificationService.sendCheckinAlert();
    this.switchTab('tab-test');
    this.startReactionTest();
  }

  async renderChartAndHistory() {
    const history = await biometricStorage.getHistory(50);

    // 1. Render Trend Chart
    if (this.chartEngine) {
      this.chartEngine.renderTrends(history, this.baseline.baselineMedianRT);
    }

    // 2. Render History Table
    const tbody = document.getElementById('tblHistoryBody');
    if (tbody) {
      tbody.innerHTML = '';
      if (history.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-dim);">No history records found.</td></tr>`;
        return;
      }

      history.forEach((row) => {
        const tr = document.createElement('tr');
        const dateStr = new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
        const statusClass = row.status === 'OPTIMAL' ? 'status-optimal' : row.status === 'MILD' ? 'status-mild' : 'status-degraded';

        tr.innerHTML = `
          <td>${dateStr}</td>
          <td><span class="status-badge ${statusClass}">${row.status}</span></td>
          <td style="color: var(--accent-cyan);">${row.medianRT} ms</td>
          <td>±${row.rtvSD} ms</td>
          <td>${row.lapses}</td>
          <td>${row.falseStarts}</td>
          <td style="font-weight: 800;">${row.fatigueScore}%</td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  setupSettingsForm() {
    const form = document.getElementById('formSettings');
    if (form) {
      // Pre-fill
      document.getElementById('selectInterval').value = this.settings.intervalMinutes;
      document.getElementById('selectResetDuration').value = this.settings.resetDurationSeconds;
      document.getElementById('chkStrictLockout').checked = this.settings.strictLockout;
      document.getElementById('chkSoundEnabled').checked = this.settings.soundEnabled;

      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        this.settings.intervalMinutes = parseInt(document.getElementById('selectInterval').value, 10);
        this.settings.resetDurationSeconds = parseInt(document.getElementById('selectResetDuration').value, 10);
        this.settings.strictLockout = document.getElementById('chkStrictLockout').checked;
        this.settings.soundEnabled = document.getElementById('chkSoundEnabled').checked;

        audioEngine.setMuted(!this.settings.soundEnabled);

        await biometricStorage.saveSettings(this.settings);
        this.resetCheckinTimer();
        alert('Settings saved successfully!');
      });
    }
  }

  setupDataExportAndWipe() {
    document.getElementById('btnExportCSV')?.addEventListener('click', async () => {
      const history = await biometricStorage.getHistory(500);
      if (history.length === 0) {
        alert('No data to export.');
        return;
      }

      let csv = 'Timestamp,ISO_Date,MedianRT_ms,MeanRT_ms,RTV_SD_ms,Lapses,FalseStarts,FatigueScore,Status\n';
      history.forEach(r => {
        csv += `${r.timestamp},"${r.dateStr}",${r.medianRT},${r.meanRT},${r.rtvSD},${r.lapses},${r.falseStarts},${r.fatigueScore},"${r.status}"\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fatigue_guard_export_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });

    document.getElementById('btnClearHistory')?.addEventListener('click', async () => {
      if (confirm('Are you sure you want to delete all local biometric test history?')) {
        await biometricStorage.clearAllData();
        await this.renderChartAndHistory();
        await this.refreshDashboard();
      }
    });
  }
}

// Instantiate on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new AppController();
  app.init();
});
