import React, { useState } from 'react';
import { BLEDeviceState } from '../../types';
import { bleService, SupportedBLECommand } from '../../services/bleService';
import {
  ShieldAlert,
  Sliders,
  Radio,
  RotateCcw,
  AlertTriangle,
  Lock,
  Unlock,
  Power,
  RefreshCw,
  X
} from 'lucide-react';

interface HardwareTestModalProps {
  bleState: BLEDeviceState;
  onClose: () => void;
}

export const HardwareTestModal: React.FC<HardwareTestModalProps> = ({ bleState, onClose }) => {
  const [safetyUnlocked, setSafetyUnlocked] = useState(false);
  const [simObstacleDist, setSimObstacleDist] = useState(30);

  const handleSendCommand = (cmd: SupportedBLECommand) => {
    bleService.sendCommand(cmd);
  };

  const handleSimulateObstacle = () => {
    bleService.triggerSimulatedObstacle(simObstacleDist);
  };

  const handleClearObstacle = () => {
    bleService.clearObstacle();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-left my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-yellow-500/20 text-yellow-400 rounded-xl">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Supervised Hardware Test Mode</h3>
              <p className="text-xs text-slate-400">ESP32 Front-Steering & Ultrasonic Diagnostics</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Safety Lock Warning */}
        <div className="p-3.5 bg-amber-950/40 border border-amber-800/60 rounded-xl mb-5 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200">
            <span className="font-bold block text-amber-300 mb-0.5">Physical Safety Guard Active</span>
            Motor traction is locked in software. Autonomous mobility is disabled until physical steering linkage, ultrasonic sweep, and independent E-stop have passed supervised inspection.
          </div>
        </div>

        {/* Hardware Status Grid */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              BLE Device
            </span>
            <span className="text-sm font-bold text-emerald-400 font-mono truncate block">
              {bleState.deviceName}
            </span>
            <span className="text-[10px] text-slate-500">Service: 12345678-...-9000</span>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Front Wheel Steer Angle
            </span>
            <span className="text-sm font-bold text-sky-400 font-mono">
              {bleState.steeringAngle > 0 ? `+${bleState.steeringAngle}° (RIGHT)` : bleState.steeringAngle < 0 ? `${bleState.steeringAngle}° (LEFT)` : '0° (CENTER)'}
            </span>
            <span className="text-[10px] text-slate-500">MG996R Tie-rod Linkage</span>
          </div>
        </div>

        {/* Section 1: Front-Wheel Steering Servo Verification */}
        <div className="mb-5">
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
            1. Front Steering Servo (MG996R Actuation)
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleSendCommand('LEFT')}
              className="py-2.5 px-3 bg-slate-800 hover:bg-sky-600 active:bg-sky-700 text-white font-bold rounded-xl border border-slate-700 text-xs transition"
            >
              Turn LEFT (-35°)
            </button>
            <button
              onClick={() => handleSendCommand('CENTER')}
              className="py-2.5 px-3 bg-slate-800 hover:bg-sky-600 active:bg-sky-700 text-white font-bold rounded-xl border border-slate-700 text-xs transition"
            >
              CENTER (0°)
            </button>
            <button
              onClick={() => handleSendCommand('RIGHT')}
              className="py-2.5 px-3 bg-slate-800 hover:bg-sky-600 active:bg-sky-700 text-white font-bold rounded-xl border border-slate-700 text-xs transition"
            >
              Turn RIGHT (+35°)
            </button>
          </div>
        </div>

        {/* Section 2: Ultrasonic Scanner (HC-SR04) */}
        <div className="mb-5">
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
            2. Ultrasonic Radar & Sweep Servo (HC-SR04)
          </label>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              onClick={() => handleSendCommand('SCAN_ON')}
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-semibold rounded-xl border border-slate-700 text-xs transition"
            >
              Start Radar Sweep (SCAN_ON)
            </button>
            <button
              onClick={() => handleSendCommand('SCAN_OFF')}
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl border border-slate-700 text-xs transition"
            >
              Halt Sweep (SCAN_OFF)
            </button>
          </div>

          {/* Simulated Obstacle Generator */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Simulate Proximity Obstacle:</span>
              <span className="font-mono text-yellow-400 font-bold">{simObstacleDist} cm</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              value={simObstacleDist}
              onChange={(e) => setSimObstacleDist(Number(e.target.value))}
              className="w-full accent-yellow-400"
            />
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSimulateObstacle}
                className="flex-1 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-black font-bold text-xs rounded-lg transition"
              >
                Inject Obstacle ({simObstacleDist}cm)
              </button>
              <button
                onClick={handleClearObstacle}
                className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Section 3: Safety E-Stop Test */}
        <div className="mb-5">
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
            3. Emergency Stop (E-Stop) Command Loop
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleSendCommand('EMERGENCY')}
              className="py-2.5 px-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Trigger EMERGENCY</span>
            </button>
            <button
              onClick={() => handleSendCommand('RESET_EMERGENCY')}
              className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl border border-slate-700 text-xs transition flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              <span>RESET_EMERGENCY</span>
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-[11px] text-slate-500 border-t border-slate-800 pt-3 flex items-center justify-between">
          <span>Firmware: STICK ESP32 v1.0</span>
          <span>Motors: L298N Dual 12V 60RPM</span>
        </div>
      </div>
    </div>
  );
};
