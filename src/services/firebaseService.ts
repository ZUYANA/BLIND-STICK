import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getDatabase, Database } from 'firebase/database';
import { EmergencyAlert, SharedBlindUserState, UserProfile, UserRole } from '../types';

// Environment or default configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDemoSTICKNavigationSystemKey",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "stick-navigation.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "stick-navigation",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "stick-navigation.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "109876543210",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:109876543210:web:abcdef123456",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://stick-navigation-default-rtdb.firebaseio.com"
};

class FirebaseService {
  public app: FirebaseApp | null = null;
  public auth: Auth | null = null;
  public firestore: Firestore | null = null;
  public realtimeDb: Database | null = null;
  public isRealFirebaseConfigured = false;

  private mockChannel: BroadcastChannel | null = null;
  private locationListeners: Array<(state: SharedBlindUserState) => void> = [];
  private emergencyListeners: Array<(alert: EmergencyAlert) => void> = [];

  constructor() {
    this.initFirebase();
    this.initMockChannel();
  }

  private initFirebase() {
    try {
      // Check if real API key is present
      const hasRealKey = import.meta.env.VITE_FIREBASE_API_KEY && !import.meta.env.VITE_FIREBASE_API_KEY.includes('Demo');
      if (hasRealKey) {
        if (!getApps().length) {
          this.app = initializeApp(firebaseConfig);
        } else {
          this.app = getApps()[0];
        }
        this.auth = getAuth(this.app);
        this.firestore = getFirestore(this.app);
        this.realtimeDb = getDatabase(this.app);
        this.isRealFirebaseConfigured = true;
        console.log('[FirebaseService] Real Firebase initialized successfully.');
      } else {
        console.log('[FirebaseService] Demo/Local mode active. Using synchronized cross-tab storage for dual-dashboard testing.');
      }
    } catch (e) {
      console.warn('[FirebaseService] Firebase init fallback to local simulator:', e);
    }
  }

  private initMockChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.mockChannel = new BroadcastChannel('stick_navigation_sync');
      this.mockChannel.onmessage = (event) => {
        const { type, payload } = event.data;
        if (type === 'LOCATION_UPDATE') {
          this.locationListeners.forEach(cb => cb(payload));
        } else if (type === 'EMERGENCY_ALERT') {
          this.emergencyListeners.forEach(cb => cb(payload));
        }
      };
    }
  }

  // --- Realtime Location Sharing ---

  public updateBlindUserLocation(state: SharedBlindUserState) {
    // 1. Local / Cross-tab broadcast
    try {
      localStorage.setItem(`stick_location_${state.userId}`, JSON.stringify(state));
      this.mockChannel?.postMessage({ type: 'LOCATION_UPDATE', payload: state });
      this.locationListeners.forEach(cb => cb(state));
    } catch (_) {}

    // 2. Realtime Database if configured
    if (this.isRealFirebaseConfigured && this.realtimeDb) {
      // Realtime Database set(ref(db, `locations/${state.userId}`), state)
    }
  }

  public subscribeBlindUserLocation(blindUserId: string, callback: (state: SharedBlindUserState) => void) {
    this.locationListeners.push(callback);

    // Initial check from local storage
    try {
      const stored = localStorage.getItem(`stick_location_${blindUserId}`);
      if (stored) {
        callback(JSON.parse(stored));
      }
    } catch (_) {}

    return () => {
      this.locationListeners = this.locationListeners.filter(c => c !== callback);
    };
  }

  // --- Emergency Alerts ---

  public async broadcastEmergencyAlert(alert: EmergencyAlert) {
    try {
      // Save locally
      const existing: EmergencyAlert[] = JSON.parse(localStorage.getItem('stick_emergency_alerts') || '[]');
      existing.unshift(alert);
      localStorage.setItem('stick_emergency_alerts', JSON.stringify(existing));

      // Broadcast
      this.mockChannel?.postMessage({ type: 'EMERGENCY_ALERT', payload: alert });
      this.emergencyListeners.forEach(cb => cb(alert));
    } catch (_) {}
  }

  public subscribeEmergencyAlerts(callback: (alert: EmergencyAlert) => void) {
    this.emergencyListeners.push(callback);
    return () => {
      this.emergencyListeners = this.emergencyListeners.filter(c => c !== callback);
    };
  }

  public getEmergencyAlerts(): EmergencyAlert[] {
    try {
      return JSON.parse(localStorage.getItem('stick_emergency_alerts') || '[]');
    } catch (_) {
      return [];
    }
  }

  public resolveEmergencyAlert(alertId: string) {
    try {
      const alerts: EmergencyAlert[] = JSON.parse(localStorage.getItem('stick_emergency_alerts') || '[]');
      const updated = alerts.map(a => a.id === alertId ? { ...a, resolved: true, status: 'RESOLVED' as const } : a);
      localStorage.setItem('stick_emergency_alerts', JSON.stringify(updated));
    } catch (_) {}
  }

  // --- Pairing System ---

  public generatePairingCode(uid: string): string {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    localStorage.setItem(`stick_pairing_code_${code}`, uid);
    return code;
  }

  public redeemPairingCode(code: string): string | null {
    const blindUid = localStorage.getItem(`stick_pairing_code_${code}`);
    return blindUid || null;
  }
}

export const firebaseService = new FirebaseService();
