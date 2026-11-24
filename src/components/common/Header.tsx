import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { BLEDeviceState } from '../../types';
import { Navigation, Bluetooth, BluetoothConnected, Shield, LogOut, Volume2, ArrowLeftRight, User, Edit3, X, Check } from 'lucide-react';
import { speechService } from '../../services/speechService';

interface HeaderProps {
  bleState?: BLEDeviceState;
  onConnectBLE?: () => void;
  onOpenHardwareTest?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ bleState, onConnectBLE, onOpenHardwareTest }) => {
  const { user, logout, login, updateProfile } = useAuth();
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [tempUserName, setTempUserName] = useState(user?.displayName || '');
  const [tempPairedName, setTempPairedName] = useState(user?.pairedWithName || '');

  const handleTestVoice = () => {
    speechService.speak(`Hello ${user?.displayName || 'User'}. STICK Voice System is active and ready.`);
  };

  const handleSwitchRole = () => {
    if (user?.role === 'blind_user') {
      login('guardian', user?.pairedWithName || 'Guardian', '', user?.displayName || 'Blind User');
    } else {
      login('blind_user', user?.pairedWithName || 'Blind User', '', user?.displayName || 'Guardian');
    }
  };

  const handleSaveNames = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempUserName.trim()) {
      updateProfile(tempUserName.trim(), tempPairedName.trim());
      speechService.speak(`Profile updated. Hello ${tempUserName.trim()}`);
    }
    setShowEditNameModal(false);
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-0 z-40 backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Logo & Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-sky-400 flex items-center justify-center shadow-lg shadow-sky-500/20 border border-sky-300/30">
            <Navigation className="w-6 h-6 text-white transform -rotate-45" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight text-white">STICK</h1>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                  user?.role === 'blind_user'
                    ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                    : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                }`}
              >
                {user?.role === 'blind_user' ? 'Blind User · Nav' : 'Guardian · Track'}
              </span>
            </div>

            {/* User and Partner Names with Quick Edit */}
            <div
              onClick={() => {
                setTempUserName(user?.displayName || '');
                setTempPairedName(user?.pairedWithName || '');
                setShowEditNameModal(true);
              }}
              title="Click to change names"
              className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white cursor-pointer group mt-0.5"
            >
              <span className="font-bold text-white group-hover:text-sky-400 transition">
                {user?.displayName || 'User'}
              </span>
              <span className="text-slate-500 text-[11px]">•</span>
              <span className="text-slate-400 text-[11px] truncate max-w-[150px]">
                {user?.role === 'blind_user' ? `Guardian: ${user?.pairedWithName || 'Guardian'}` : `Tracking: ${user?.pairedWithName || 'Blind User'}`}
              </span>
              <Edit3 className="w-3 h-3 text-slate-500 group-hover:text-sky-400 opacity-60 group-hover:opacity-100 transition" />
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* BLE Hardware Status Button */}
          {bleState && onConnectBLE && (
            <button
              onClick={bleState.connected ? onOpenHardwareTest : onConnectBLE}
              title={bleState.connected ? 'STICK BLE Connected (Click for Hardware Diagnostics)' : 'Connect STICK ESP32 via BLE'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                bleState.connected
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/40'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:text-white hover:border-sky-500'
              }`}
            >
              {bleState.connected ? (
                <>
                  <BluetoothConnected className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline">STICK Online</span>
                  <span className="text-[10px] bg-emerald-500/20 px-1.5 py-0.2 rounded font-mono">
                    {bleState.batteryLevel || 90}%
                  </span>
                </>
              ) : (
                <>
                  <Bluetooth className="w-4 h-4 text-sky-400" />
                  <span className="hidden sm:inline">Connect BLE</span>
                </>
              )}
            </button>
          )}

          {/* Voice Prompt Test */}
          <button
            onClick={handleTestVoice}
            title="Test Voice Speech Synthesis"
            aria-label="Test Speech Audio"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition"
          >
            <Volume2 className="w-4 h-4 text-sky-400" />
          </button>

          {/* Switch Role on localhost without logging out */}
          <button
            onClick={handleSwitchRole}
            title={`Switch role to ${user?.role === 'blind_user' ? 'Guardian' : 'Blind User'}`}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl border border-slate-700 transition"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-yellow-400" />
            <span>Switch Role</span>
          </button>

          {/* Logout */}
          <button
            onClick={logout}
            title="Sign Out / Change User"
            className="p-2 bg-slate-800 hover:bg-red-950/50 hover:text-red-400 text-slate-400 rounded-xl border border-slate-700 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Edit Names Modal */}
      {showEditNameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <User className="w-4 h-4 text-sky-400" />
                Change Display Names
              </h3>
              <button
                onClick={() => setShowEditNameModal(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNames} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {user?.role === 'blind_user' ? "Your Name (Blind User):" : "Your Name (Guardian):"}
                </label>
                <input
                  type="text"
                  required
                  value={tempUserName}
                  onChange={(e) => setTempUserName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm font-semibold text-white focus:border-sky-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {user?.role === 'blind_user' ? "Linked Guardian's Name:" : "Linked Blind User's Name:"}
                </label>
                <input
                  type="text"
                  required
                  value={tempPairedName}
                  onChange={(e) => setTempPairedName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm font-semibold text-white focus:border-sky-500 outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl shadow transition"
                >
                  Save Names
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditNameModal(false)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
