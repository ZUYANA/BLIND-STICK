import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types';
import { firebaseService } from '../services/firebaseService';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (role: UserRole, displayName?: string, email?: string, pairedWithName?: string) => Promise<void>;
  signup: (role: UserRole, displayName: string, email: string, pairedWithName?: string) => Promise<void>;
  updateProfile: (displayName: string, pairedWithName?: string) => void;
  logout: () => void;
  pairWithUser: (pairingCode: string, blindUserName?: string) => Promise<boolean>;
  generateNewPairingCode: () => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'stick_current_user_profile';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore saved session on startup
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch (e) {
      console.error('[AuthProvider] Failed to read stored user:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (
    role: UserRole,
    displayName = '',
    email = '',
    pairedWithName = ''
  ) => {
    // If not provided, fetch any previously saved paired name
    const savedPairedName =
      pairedWithName ||
      localStorage.getItem(role === 'blind_user' ? 'stick_saved_guardian_name' : 'stick_saved_blind_user_name') ||
      (role === 'blind_user' ? 'Ananya (Guardian)' : 'Ramesh (Blind User)');

    const finalDisplayName =
      displayName.trim() ||
      (role === 'blind_user' ? 'Ramesh' : 'Ananya');

    // Save for persistent memory across role switches
    if (role === 'blind_user') {
      localStorage.setItem('stick_saved_blind_user_name', finalDisplayName);
      if (pairedWithName) localStorage.setItem('stick_saved_guardian_name', pairedWithName);
    } else {
      localStorage.setItem('stick_saved_guardian_name', finalDisplayName);
      if (pairedWithName) localStorage.setItem('stick_saved_blind_user_name', pairedWithName);
    }

    const profile: UserProfile = {
      uid: role === 'blind_user' ? 'stick-blind-user-01' : 'stick-guardian-01',
      email: email || (role === 'blind_user' ? `${finalDisplayName.toLowerCase().replace(/\s+/g, '')}@stick.org` : `${finalDisplayName.toLowerCase().replace(/\s+/g, '')}.guardian@stick.org`),
      displayName: finalDisplayName,
      role,
      pairedWithUid: role === 'guardian' ? 'stick-blind-user-01' : 'stick-guardian-01',
      pairedWithName: savedPairedName,
      createdAt: Date.now()
    };

    setUser(profile);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile));
  };

  const signup = async (
    role: UserRole,
    displayName: string,
    email: string,
    pairedWithName = ''
  ) => {
    const finalDisplayName = displayName.trim() || (role === 'blind_user' ? 'Blind User' : 'Guardian');
    const finalPairedName = pairedWithName.trim() || (role === 'blind_user' ? 'Guardian' : 'Blind User');

    const newUid = `user-${Date.now()}`;
    const profile: UserProfile = {
      uid: newUid,
      email: email || `${finalDisplayName.toLowerCase()}@stick.org`,
      displayName: finalDisplayName,
      role,
      pairedWithName: finalPairedName,
      createdAt: Date.now()
    };

    setUser(profile);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile));
  };

  const updateProfile = (displayName: string, pairedWithName?: string) => {
    if (!user) return;
    const updated: UserProfile = {
      ...user,
      displayName: displayName.trim() || user.displayName,
      pairedWithName: pairedWithName?.trim() || user.pairedWithName
    };
    setUser(updated);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));

    if (user.role === 'blind_user') {
      localStorage.setItem('stick_saved_blind_user_name', updated.displayName);
      if (updated.pairedWithName) localStorage.setItem('stick_saved_guardian_name', updated.pairedWithName);
    } else {
      localStorage.setItem('stick_saved_guardian_name', updated.displayName);
      if (updated.pairedWithName) localStorage.setItem('stick_saved_blind_user_name', updated.pairedWithName);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  };

  const pairWithUser = async (pairingCode: string, blindUserName?: string): Promise<boolean> => {
    if (!user) return false;
    const targetUid = firebaseService.redeemPairingCode(pairingCode);
    if (targetUid || pairingCode === '123456') {
      const savedBlindName = blindUserName || localStorage.getItem('stick_saved_blind_user_name') || 'Blind User';
      const updated: UserProfile = {
        ...user,
        pairedWithUid: targetUid || 'stick-blind-user-01',
        pairedWithName: savedBlindName
      };
      setUser(updated);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      return true;
    }
    return false;
  };

  const generateNewPairingCode = (): string => {
    if (!user) return '123456';
    const code = firebaseService.generatePairingCode(user.uid);
    const updated = { ...user, pairingCode: code };
    setUser(updated);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    return code;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signup,
        updateProfile,
        logout,
        pairWithUser,
        generateNewPairingCode
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
