// Main Application Controller - Soothing Dark Pastel Zen Design

import { audioEngine } from './modules/audio.js';
import { biometricStorage } from './modules/storage.js';
import { notificationService } from './modules/notifications.js';
import { CanvasPVTTestEngine } from './modules/pvtTest.js';
import { PhysiologicalResetEngine } from './modules/resetProtocol.js';

class AppController {
  constructor() {
    this.deferredInstallPrompt = null;
    this.settings = null;
    this.baseline = null;

    // Engines
    this.pvtEngine = null;
    this.resetEngine = null;
    this.lockoutResetEngine = null;

    // Timer state
    this.checkinTimerId = null;
    this.nextCheckinTimestamp = Date.now() + 120 * 60 * 1000;
  }

  async init() {
    this.settings = await biometricStorage.getSettings();
    this.baseline = await biometricStorage.computeBaseline();

    this.registerServiceWorker();
    this.setupNavigation();
    this.setupPWAInstaller();
    this.setupAudioAndNotifications();
    this.setupSettingsForm();

    this.initEngines();
    await this.refreshDashboard();
    this.startCheckinTimer();

    notificationService.requestPermission();
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(() => console.log('Service Worker registered.'))
        .catch((err) => console.error('Service worker error:', err));
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
        if (audioLabel) audioLabel.textContent = 'Звук ВЫКЛ';
      } else {
        if (audioIcon) audioIcon.textContent = '🔊';
        if (audioLabel) audioLabel.textContent = 'Звук ВКЛ';
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

        if (targetTab === 'tab-protocol') {
          if (this.resetEngine) this.resetEngine.startProtocol();
        }
      });
    });

    document.getElementById('btnQuickTest')?.addEventListener('click', () => {
      this.switchTab('tab-test');
      this.startReactionTest();
    });

    document.getElementById('btnQuickReset')?.addEventListener('click', () => {
      this.switchTab('tab-protocol');
      if (this.resetEngine) this.resetEngine.startProtocol();
    });

    // Direct 1-tap "All is good (Reset Timer)" button
    document.getElementById('btnResetTimerDirect')?.addEventListener('click', () => {
      audioEngine.playSuccessChord();
      this.resetCheckinTimer();
      alert('Таймер проверок сброшен. Следующая пауза через 2 часа.');
    });

    document.getElementById('btnStartTestTab')?.addEventListener('click', () => {
      this.startReactionTest();
    });

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
          console.log('Manual reset completed.');
        }
      });
    }
  }

  startReactionTest() {
    if (this.pvtEngine) {
      this.pvtEngine.baseline = this.baseline;
      this.pvtEngine.startTest();
    }
  }

  async handleTestCompleted(results) {
    await biometricStorage.saveTestRun(results);
    this.baseline = await biometricStorage.computeBaseline();
    await this.refreshDashboard();
    this.resetCheckinTimer();

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

    if (lastRun && badge) {
      badge.className = 'status-badge';
      if (lastRun.status === 'OPTIMAL') {
        badge.classList.add('status-optimal');
        badge.textContent = 'ОПТИМАЛЬНОЕ';
      } else {
        badge.classList.add('status-degraded');
        badge.textContent = 'НУЖЕН ОТДЫХ';
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

  setupSettingsForm() {
    const form = document.getElementById('formSettings');
    if (form) {
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
        alert('Настройки успешно сохранены!');
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new AppController();
  app.init();
});
