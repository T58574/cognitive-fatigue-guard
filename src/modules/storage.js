// IndexedDB Local Storage Subsystem for Cognitive Fatigue Dynamics

const DB_NAME = 'CognitiveFatigueGuardDB';
const DB_VERSION = 1;
const STORE_TESTS = 'test_runs';
const STORE_SETTINGS = 'settings';

class BiometricStorage {
  constructor() {
    this.db = null;
  }

  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_TESTS)) {
          const testStore = db.createObjectStore(STORE_TESTS, { keyPath: 'id', autoIncrement: true });
          testStore.createIndex('timestamp', 'timestamp', { unique: false });
          testStore.createIndex('status', 'status', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB open error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Save a completed 15-second micro-test result
  async saveTestRun(data) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_TESTS, 'readwrite');
      const store = tx.objectStore(STORE_TESTS);

      const record = {
        timestamp: Date.now(),
        dateStr: new Date().toISOString(),
        reactionTimes: data.reactionTimes || [],
        medianRT: data.medianRT,
        meanRT: data.meanRT,
        rtvSD: data.rtvSD, // Reaction Time Variability (Standard Deviation)
        lapses: data.lapses || 0,
        falseStarts: data.falseStarts || 0,
        fatigueScore: data.fatigueScore, // 0 to 100
        status: data.status, // 'OPTIMAL' | 'MILD' | 'DEGRADED'
        lockoutTriggered: data.status === 'DEGRADED'
      };

      const request = store.add(record);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  // Fetch all historic test runs sorted by timestamp desc
  async getHistory(limit = 100) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_TESTS, 'readonly');
      const store = tx.objectStore(STORE_TESTS);
      const index = store.index('timestamp');
      const request = index.openCursor(null, 'prev');

      const results = [];
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = (e) => reject(e.target.error);
    });
  }

  // Compute Rolling Baseline from optimal runs
  async computeBaseline() {
    const history = await this.getHistory(30);
    if (history.length < 3) {
      // Default baseline values if not enough data
      return {
        baselineMedianRT: 260,
        baselineRTV: 35,
        totalRuns: history.length,
        isCustom: false
      };
    }

    // Filter optimal/healthy runs for baseline computation
    const optimalRuns = history.filter(h => h.status === 'OPTIMAL' || h.fatigueScore < 20);
    const targetRuns = optimalRuns.length >= 3 ? optimalRuns : history.slice(0, 10);

    const medianSum = targetRuns.reduce((acc, r) => acc + r.medianRT, 0);
    const rtvSum = targetRuns.reduce((acc, r) => acc + r.rtvSD, 0);

    return {
      baselineMedianRT: Math.round(medianSum / targetRuns.length),
      baselineRTV: Math.round(rtvSum / targetRuns.length),
      totalRuns: history.length,
      isCustom: true
    };
  }

  // Get App Settings
  async getSettings() {
    await this.init();
    return new Promise((resolve) => {
      const tx = this.db.transaction(STORE_SETTINGS, 'readonly');
      const store = tx.objectStore(STORE_SETTINGS);
      const request = store.get('user_settings');

      request.onsuccess = () => {
        const defaultSettings = {
          intervalMinutes: 120, // Check-in every 2 hours
          strictLockout: true,  // Enforce protocol reset modal on degradation
          soundEnabled: true,
          notificationsEnabled: true,
          resetDurationSeconds: 180 // 3 minute reset protocol
        };
        resolve(request.result ? { ...defaultSettings, ...request.result.value } : defaultSettings);
      };
      request.onerror = () => {
        resolve({
          intervalMinutes: 120,
          strictLockout: true,
          soundEnabled: true,
          notificationsEnabled: true,
          resetDurationSeconds: 180
        });
      };
    });
  }

  // Save App Settings
  async saveSettings(settingsObj) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_SETTINGS, 'readwrite');
      const store = tx.objectStore(STORE_SETTINGS);
      const request = store.put({ key: 'user_settings', value: settingsObj });
      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  // Clear all DB data
  async clearAllData() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORE_TESTS], 'readwrite');
      const request = tx.objectStore(STORE_TESTS).clear();
      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  }
}

export const biometricStorage = new BiometricStorage();
