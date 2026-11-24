import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { Eye, Shield, User, ArrowRight, Sparkles, Navigation, Lock, CheckCircle2, HeartHandshake } from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const { login, signup } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>('blind_user');
  const [isSignUp, setIsSignUp] = useState(false);

  // Name inputs for Blind User & Guardian
  const [blindUserName, setBlindUserName] = useState<string>(() => {
    return localStorage.getItem('stick_saved_blind_user_name') || 'Ramesh';
  });
  const [guardianName, setGuardianName] = useState<string>(() => {
    return localStorage.getItem('stick_saved_guardian_name') || 'Ananya';
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLaunchDashboard = (role: UserRole) => {
    if (role === 'blind_user') {
      login('blind_user', blindUserName || 'Ramesh', email, guardianName || 'Ananya');
    } else {
      login('guardian', guardianName || 'Ananya', email, blindUserName || 'Ramesh');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSignUp) {
      if (selectedRole === 'blind_user') {
        signup('blind_user', blindUserName || 'Ramesh', email || 'blind@stick.org', guardianName);
      } else {
        signup('guardian', guardianName || 'Ananya', email || 'guardian@stick.org', blindUserName);
      }
    } else {
      handleLaunchDashboard(selectedRole);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100">
      <div className="max-w-md w-full">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-600 to-sky-400 shadow-xl shadow-sky-500/20 mb-3 border border-sky-300/30">
            <Navigation className="w-9 h-9 text-white transform -rotate-45" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
            STICK
            <span className="text-xs uppercase px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 font-semibold border border-sky-500/30">
              Navigation & Care
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">Smart Voice Navigation & Guardian Tracking System</p>
        </div>

        {/* Main Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl mb-6">
          {/* Step 1: Enter User Names */}
          <div className="mb-5 pb-5 border-b border-slate-800">
            <label className="block text-xs font-bold text-sky-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <User className="w-4 h-4" />
              1. Enter Person Names
            </label>
            <p className="text-xs text-slate-400 mb-3">
              Type your name and your partner's name so both dashboards clearly show who is who.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-sky-400" />
                  Blind User's Name (Walking with STICK):
                </label>
                <input
                  type="text"
                  required
                  value={blindUserName}
                  onChange={(e) => setBlindUserName(e.target.value)}
                  placeholder="e.g. Ramesh, Rahul, Sarah..."
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-semibold text-white placeholder-slate-500 focus:border-sky-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  Guardian's Name (Tracking & Safety):
                </label>
                <input
                  type="text"
                  required
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  placeholder="e.g. Ananya, Priya, David..."
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-semibold text-white placeholder-slate-500 focus:border-emerald-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Step 2: Choose Which Dashboard to Enter */}
          <div className="mb-5">
            <label className="block text-xs font-bold text-sky-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <HeartHandshake className="w-4 h-4" />
              2. Choose Dashboard to Open Right Now
            </label>

            <div className="grid grid-cols-1 gap-2.5">
              {/* Enter as Blind User Button */}
              <button
                type="button"
                onClick={() => handleLaunchDashboard('blind_user')}
                className="w-full p-3.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 active:scale-[0.99] text-white rounded-xl shadow-lg shadow-sky-600/20 font-bold text-sm transition flex items-center justify-between group"
              >
                <div className="flex items-center gap-3 text-left">
                  <div className="p-2 bg-sky-500/30 rounded-lg">
                    <Eye className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="font-extrabold text-base">
                      Enter as {blindUserName.trim() || 'Blind User'}
                    </div>
                    <div className="text-xs text-sky-200">
                      Voice Navigation Dashboard · Guardian: {guardianName.trim() || 'Guardian'}
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>

              {/* Enter as Guardian Button */}
              <button
                type="button"
                onClick={() => handleLaunchDashboard('guardian')}
                className="w-full p-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] text-white rounded-xl shadow-lg shadow-emerald-600/20 font-bold text-sm transition flex items-center justify-between group"
              >
                <div className="flex items-center gap-3 text-left">
                  <div className="p-2 bg-emerald-500/30 rounded-lg">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="font-extrabold text-base">
                      Enter as {guardianName.trim() || 'Guardian'}
                    </div>
                    <div className="text-xs text-emerald-200">
                      Live Tracking Dashboard · Monitoring: {blindUserName.trim() || 'Blind User'}
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* Optional: Credentials Sign Up toggle for Production */}
          <div className="pt-3 border-t border-slate-800 text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs text-slate-400 hover:text-sky-400 font-medium transition"
            >
              {isSignUp ? 'Close Custom Email/Password' : 'Configure Custom Email & Password (Optional)'}
            </button>

            {isSignUp && (
              <form onSubmit={handleSubmit} className="mt-3 text-left space-y-2.5">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@stick.org"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl"
                >
                  Save Account
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Info footer */}
        <div className="text-center text-xs text-slate-500 space-y-1">
          <p className="flex items-center justify-center gap-1.5 text-slate-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Names automatically sync to Google Maps & live tracking
          </p>
        </div>
      </div>
    </div>
  );
};
