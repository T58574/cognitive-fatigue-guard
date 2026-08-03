// Web Notifications Subsystem

import { audioEngine } from './audio.js';

class NotificationService {
  constructor() {
    this.hasPermission = false;
  }

  async requestPermission() {
    if (!('Notification' in window)) {
      console.warn('Web Notifications not supported on this device/browser.');
      return false;
    }

    if (Notification.permission === 'granted') {
      this.hasPermission = true;
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      this.hasPermission = (permission === 'granted');
      return this.hasPermission;
    }

    return false;
  }

  async sendCheckinAlert() {
    audioEngine.playLockdownAlert();

    const title = '⚠️ Cognitive Fatigue Guard Check-in';
    const options = {
      body: '2-hour work cycle reached. 15-second CNS reaction test required now.',
      icon: '/icon-192.svg',
      badge: '/icon-192.svg',
      tag: 'fatigue-checkin',
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 300]
    };

    if (this.hasPermission && 'Notification' in window && Notification.permission === 'granted') {
      try {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          const registration = await navigator.serviceWorker.ready;
          registration.showNotification(title, options);
        } else {
          new Notification(title, options);
        }
      } catch (e) {
        console.error('Failed to dispatch notification:', e);
      }
    }
  }

  async sendLockoutAlert(fatigueScore) {
    audioEngine.playLockdownAlert();

    const title = '🚨 HARD LOCK: CNS Micro-Degradation Detected!';
    const options = {
      body: `Your CNS reaction variability dropped by ${fatigueScore}%. Mandatory physiological reset protocol engaged.`,
      icon: '/icon-192.svg',
      tag: 'fatigue-lockout',
      requireInteraction: true,
      vibrate: [500, 200, 500, 200, 500]
    };

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, options);
      } catch (e) {
        console.error('Error triggering lockout notification:', e);
      }
    }
  }
}

export const notificationService = new NotificationService();
