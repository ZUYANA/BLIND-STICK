import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { BLEDeviceState } from './types';
import { bleService } from './services/bleService';
import { CHIKKAMAGALURU_COORDS } from './services/placesService';

import { Header } from './components/common/Header';
import { AuthScreen } from './components/auth/AuthScreen';
import { BlindDashboard } from './components/blind/BlindDashboard';
import { GuardianDashboard } from './components/guardian/GuardianDashboard';
import { HardwareTestModal } from './components/blind/HardwareTestModal';
import { EmergencyModal } from './components/common/EmergencyModal';

export const AppContent: React.FC = () => {
  const { user, loading } = useAuth();

  const [bleState, setBleState] = useState<BLEDeviceState>(bleService.getState());
  const [showHardwareTest, setShowHardwareTest] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);

  useEffect(() => {
    const unsubscribe = bleService.subscribe((state) => {
      setBleState(state);
      if (state.emergencyTriggered) {
        setShowEmergencyModal(true);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleConnectBLE = async () => {
    await bleService.connect();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold tracking-wider uppercase text-slate-400">Loading STICK...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header Navigation */}
      <Header
        bleState={bleState}
        onConnectBLE={handleConnectBLE}
        onOpenHardwareTest={() => setShowHardwareTest(true)}
      />

      {/* Role-Based Dashboard View */}
      <main className="flex-1 pb-10">
        {user.role === 'blind_user' ? (
          <BlindDashboard
            bleState={bleState}
            onConnectBLE={handleConnectBLE}
            onOpenHardwareTest={() => setShowHardwareTest(true)}
            onTriggerEmergency={() => setShowEmergencyModal(true)}
          />
        ) : (
          <GuardianDashboard />
        )}
      </main>

      {/* Supervised Hardware Test Modal */}
      {showHardwareTest && (
        <HardwareTestModal
          bleState={bleState}
          onClose={() => setShowHardwareTest(false)}
        />
      )}

      {/* Emergency Alert Modal */}
      {showEmergencyModal && (
        <EmergencyModal
          currentLocation={CHIKKAMAGALURU_COORDS}
          onClose={() => setShowEmergencyModal(false)}
        />
      )}
    </div>
  );
};
