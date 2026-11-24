import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { EmergencyAlert, SharedBlindUserState } from '../../types';
import { firebaseService } from '../../services/firebaseService';
import { CHIKKAMAGALURU_COORDS } from '../../services/placesService';
import { InteractiveMap } from '../common/InteractiveMap';
import { speechService } from '../../services/speechService';
import {
  Shield,
  UserCheck,
  MapPin,
  Clock,
  Battery,
  AlertTriangle,
  CheckCircle2,
  Navigation,
  Bluetooth,
  Link,
  ExternalLink,
  Compass,
  Radio,
  RefreshCw,
  Bell
} from 'lucide-react';

export const GuardianDashboard: React.FC = () => {
  const { user, pairWithUser } = useAuth();

  // Paired Blind User Live State
  const [blindState, setBlindState] = useState<SharedBlindUserState | null>(null);
  const [lastSeenSecondsAgo, setLastSeenSecondsAgo] = useState<number>(0);
  const [pairingCodeInput, setPairingCodeInput] = useState('');
  const [pairingMessage, setPairingMessage] = useState<{ text: string; error?: boolean } | null>(null);

  // Emergency Alerts
  const [emergencyAlerts, setEmergencyAlerts] = useState<EmergencyAlert[]>([]);
  const [activeEmergency, setActiveEmergency] = useState<EmergencyAlert | null>(null);

  // Subscribe to live location of paired blind user
  useEffect(() => {
    const targetUid = user?.pairedWithUid || 'stick-blind-user-01';

    const unsubscribeLocation = firebaseService.subscribeBlindUserLocation(targetUid, (state) => {
      setBlindState(state);
    });

    const unsubscribeEmergencies = firebaseService.subscribeEmergencyAlerts((alert) => {
      setEmergencyAlerts(firebaseService.getEmergencyAlerts());
      if (!alert.resolved) {
        setActiveEmergency(alert);
        speechService.playEmergencyAlarm();
      }
    });

    // Initial fetch of emergency alerts
    setEmergencyAlerts(firebaseService.getEmergencyAlerts());

    // Timer to update last-seen seconds
    const interval = setInterval(() => {
      if (blindState?.timestamp) {
        setLastSeenSecondsAgo(Math.round((Date.now() - blindState.timestamp) / 1000));
      }
    }, 1000);

    return () => {
      unsubscribeLocation();
      unsubscribeEmergencies();
      clearInterval(interval);
    };
  }, [user?.pairedWithUid, blindState?.timestamp]);

  // Handle Pairing Code Submission
  const handlePairSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairingCodeInput.trim()) return;

    const success = await pairWithUser(pairingCodeInput.trim());
    if (success) {
      setPairingMessage({ text: 'Successfully paired with Blind User!' });
      setPairingCodeInput('');
      speechService.playConfirmChime();
    } else {
      setPairingMessage({ text: 'Invalid code. Check the 6-digit code on the blind user’s screen.', error: true });
    }
  };

  const handleResolveAlert = (alertId: string) => {
    firebaseService.resolveEmergencyAlert(alertId);
    setEmergencyAlerts(firebaseService.getEmergencyAlerts());
    if (activeEmergency?.id === alertId) {
      setActiveEmergency(null);
    }
    speechService.speak('Emergency alert marked as resolved.');
  };

  const isStale = lastSeenSecondsAgo > 45;

  return (
    <div className="max-w-7xl mx-auto px-4 py-5 space-y-6">
      {/* Active Emergency Alert Banner */}
      {activeEmergency && (
        <div className="bg-red-600 text-white rounded-2xl p-5 shadow-2xl border-2 border-red-300 animate-emergency flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-white text-red-600 rounded-xl">
              <AlertTriangle className="w-8 h-8 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-widest bg-red-800 px-2.5 py-0.5 rounded-full">
                  HIGH PRIORITY EMERGENCY
                </span>
                <span className="text-xs text-red-100 font-mono">
                  {new Date(activeEmergency.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <h2 className="text-xl font-black mt-1">
                {activeEmergency.blindUserName || 'Blind User'} triggered SOS!
              </h2>
              <p className="text-xs text-red-100 mt-0.5">
                Location: Chikkamagaluru ({activeEmergency.location.lat.toFixed(4)}, {activeEmergency.location.lng.toFixed(4)}) · Movement stopped
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${activeEmergency.location.lat},${activeEmergency.location.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-none px-4 py-2.5 bg-white text-red-700 font-bold text-xs rounded-xl hover:bg-red-50 transition flex items-center justify-center gap-1.5"
            >
              <span>Google Maps</span>
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={() => handleResolveAlert(activeEmergency.id)}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-red-950 hover:bg-red-900 text-white font-bold text-xs rounded-xl border border-red-400 transition"
            >
              Resolve Alert
            </button>
          </div>
        </div>
      )}

      {/* Personalized Guardian Welcome Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl px-5 py-3 shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
            {user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'G'}
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
              Guardian Live Tracking Dashboard
            </div>
            <div className="text-base font-extrabold text-white flex items-center gap-2">
              <span>Guardian: {user?.displayName || 'Guardian'}</span>
              <span className="text-xs text-slate-500 font-normal">•</span>
              <span className="text-xs text-sky-400 font-medium">
                Monitoring Blind User: {blindState?.displayName || user?.pairedWithName || 'Blind User'}
              </span>
            </div>
          </div>
        </div>

        <div className="text-xs text-emerald-400 bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-800 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Active Guardian Link</span>
        </div>
      </div>

      {/* Top Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Linked User Profile Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between text-xs text-slate-400 uppercase font-semibold mb-2">
            <span>Linked Blind User</span>
            <UserCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-white truncate">
            {blindState?.displayName || 'Ramesh (Blind User)'}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-2.5 h-2.5 rounded-full ${isStale ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
            <span className="text-xs text-slate-300">
              {isStale ? `Last seen ${lastSeenSecondsAgo}s ago` : 'Online · Realtime GPS'}
            </span>
          </div>
        </div>

        {/* Live Location Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between text-xs text-slate-400 uppercase font-semibold mb-2">
            <span>Location Coverage</span>
            <MapPin className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-base font-bold text-sky-300 truncate">
            Chikkamagaluru, India
          </div>
          <div className="text-xs text-slate-400 font-mono mt-1">
            {blindState?.location
              ? `${blindState.location.lat.toFixed(4)}, ${blindState.location.lng.toFixed(4)}`
              : `${CHIKKAMAGALURU_COORDS.lat}, ${CHIKKAMAGALURU_COORDS.lng}`}
          </div>
        </div>

        {/* Navigation State */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between text-xs text-slate-400 uppercase font-semibold mb-2">
            <span>Navigation Activity</span>
            <Navigation className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-sm font-bold text-white truncate">
            {blindState?.currentRoute
              ? blindState.currentRoute.destinationName
              : blindState?.navigationStatus === 'navigating'
              ? 'Walking on pedestrian path'
              : 'Stationary / Idle'}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {blindState?.currentRoute ? `${blindState.currentRoute.distanceRemainingMeters}m remaining` : 'No active destination'}
          </div>
        </div>

        {/* Physical STICK BLE Hardware Info */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between text-xs text-slate-400 uppercase font-semibold mb-2">
            <span>STICK Hardware (ESP32)</span>
            <Bluetooth className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-center gap-2 text-base font-bold text-white">
            <Battery className="w-4 h-4 text-emerald-400" />
            <span>{blindState?.bleStatus?.batteryLevel || 88}% Battery</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {blindState?.bleStatus?.connected ? 'ESP32 Connected via BLE' : 'Hardware Simulation Mode'}
          </div>
        </div>
      </div>

      {/* Main Map View & Tracking Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Full Interactive Live Map */}
        <div className="lg:col-span-8 flex flex-col space-y-3">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
              <div>
                <h3 className="text-sm font-bold text-white">Realtime Blind User Tracking Map</h3>
                <p className="text-xs text-slate-400">Live GPS tracking via OpenStreetMap & Chikkamagaluru Carto</p>
              </div>
            </div>

            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800 font-mono">
              Live updates every 3s
            </span>
          </div>

          <div className="h-[520px] min-h-[480px] relative">
            <InteractiveMap
              currentLocation={blindState?.location || CHIKKAMAGALURU_COORDS}
              heading={blindState?.heading || 0}
              obstacleDetected={blindState?.bleStatus?.obstacleDetected}
              className="h-full w-full min-h-[480px]"
            />
          </div>
        </div>

        {/* Right Sidebar: Pairing & Emergency History */}
        <div className="lg:col-span-4 space-y-5">
          {/* Pairing Manager */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              <Link className="w-4 h-4 text-sky-400" />
              Pair Blind User Device
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Enter the 6-digit code shown on the Blind User's dashboard to establish authenticated tracking.
            </p>

            <form onSubmit={handlePairSubmit} className="space-y-2.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  value={pairingCodeInput}
                  onChange={(e) => setPairingCodeInput(e.target.value)}
                  placeholder="e.g. 123456"
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-center font-mono font-bold text-lg tracking-widest text-sky-400 placeholder-slate-600 focus:border-sky-500 outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl shadow transition"
                >
                  Pair
                </button>
              </div>

              {pairingMessage && (
                <div
                  className={`text-xs p-2 rounded-lg ${
                    pairingMessage.error
                      ? 'bg-red-950/40 text-red-300 border border-red-800'
                      : 'bg-emerald-950/40 text-emerald-300 border border-emerald-800'
                  }`}
                >
                  {pairingMessage.text}
                </div>
              )}
            </form>
          </div>

          {/* Emergency Alert History Feed */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-yellow-400" />
                Emergency Alert Log
              </span>
              <span className="text-[10px] text-slate-500">
                {emergencyAlerts.length} recorded
              </span>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {emergencyAlerts.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500/40 mx-auto mb-1.5" />
                  No emergency alerts recorded. All systems normal.
                </div>
              ) : (
                emergencyAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-xl border text-xs transition ${
                      alert.resolved
                        ? 'bg-slate-950/50 border-slate-800 text-slate-400'
                        : 'bg-red-950/30 border-red-700/60 text-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold">{alert.blindUserName}</span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-[11px] mb-2">
                      Location: {alert.location.lat.toFixed(4)}, {alert.location.lng.toFixed(4)}
                    </div>
                    {!alert.resolved && (
                      <button
                        onClick={() => handleResolveAlert(alert.id)}
                        className="px-2.5 py-1 bg-red-800 hover:bg-red-700 text-white font-medium rounded-lg text-[10px] transition"
                      >
                        Mark Resolved
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
