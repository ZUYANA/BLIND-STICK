import React, { useState, useEffect } from 'react';
import { Coordinates } from '../../types';
import { speechService } from '../../services/speechService';
import { bleService } from '../../services/bleService';
import { firebaseService } from '../../services/firebaseService';
import { useAuth } from '../../context/AuthContext';
import { AlertOctagon, CheckCircle2, Phone, X, ExternalLink, ShieldAlert } from 'lucide-react';

interface EmergencyModalProps {
  currentLocation: Coordinates;
  onClose: () => void;
}

export const EmergencyModal: React.FC<EmergencyModalProps> = ({ currentLocation, onClose }) => {
  const { user } = useAuth();
  const [confirmed, setConfirmed] = useState(false);
  const [alertId, setAlertId] = useState<string | null>(null);

  useEffect(() => {
    // 1. Play Alarm
    speechService.playEmergencyAlarm();

    // 2. Transmit STOP & EMERGENCY to ESP32 hardware
    bleService.sendCommand('EMERGENCY');
    bleService.sendCommand('STOP');

    // 3. Dispatch to Firebase & Guardian
    const newAlertId = `alert-${Date.now()}`;
    setAlertId(newAlertId);

    firebaseService.broadcastEmergencyAlert({
      id: newAlertId,
      blindUserId: user?.uid || 'stick-blind-user-01',
      blindUserName: user?.displayName || 'Blind User',
      timestamp: Date.now(),
      location: currentLocation,
      resolved: false,
      status: 'ACTIVE',
      batteryLevel: 90,
      message: 'EMERGENCY: User activated SOS assistance in Chikkamagaluru.'
    });

    setConfirmed(true);
  }, []);

  const handleResolveAndDismiss = () => {
    if (alertId) {
      firebaseService.resolveEmergencyAlert(alertId);
    }
    bleService.sendCommand('RESET_EMERGENCY');
    speechService.speak('Emergency alert resolved. Returning to normal dashboard.');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-red-950/90 backdrop-blur-md">
      <div className="bg-slate-900 border-2 border-red-500 rounded-3xl max-w-md w-full p-6 text-center shadow-2xl animate-emergency">
        <div className="w-20 h-20 bg-red-600 rounded-2xl mx-auto flex items-center justify-center text-white shadow-xl shadow-red-600/50 mb-4 animate-bounce">
          <AlertOctagon className="w-12 h-12" />
        </div>

        <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-1">
          EMERGENCY SOS ACTIVE
        </h2>
        <p className="text-sm text-red-200 mb-4">
          All motor movements stopped. Physical STICK device locked in E-Stop state.
        </p>

        {/* Status card */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-left space-y-2 mb-6">
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>Guardian Ananya notified with live GPS</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>ESP32 Hardware E-Stop signal dispatched</span>
          </div>
          <div className="text-xs text-slate-400 font-mono pt-1 border-t border-slate-800">
            Current GPS: {currentLocation.lat.toFixed(5)}, {currentLocation.lng.toFixed(5)} (Chikkamagaluru)
          </div>
        </div>

        <div className="space-y-3">
          <a
            href={`tel:112`}
            className="w-full py-3 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-black text-sm uppercase rounded-xl shadow-lg transition flex items-center justify-center gap-2"
          >
            <Phone className="w-4 h-4" />
            <span>Call Emergency Services (112)</span>
          </a>

          <button
            onClick={handleResolveAndDismiss}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition"
          >
            Cancel / Mark Emergency Resolved
          </button>
        </div>
      </div>
    </div>
  );
};
