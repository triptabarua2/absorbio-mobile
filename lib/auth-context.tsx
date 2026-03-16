import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInAnonymously,
  signOut,
  User,
} from 'firebase/auth';
import { auth, googleProvider, facebookProvider } from './firebase';
import { getUserData, initializeUserData, UserData } from './firebase-db';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  isGuest: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  signInAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  // Check for offline guest on app start
  useEffect(() => {
    const checkOfflineGuest = async () => {
      try {
        const offlineGuest = await AsyncStorage.getItem('absorbio_offline_guest');
        if (offlineGuest === 'true') {
          setIsGuest(true);
          const savedGuestData = await AsyncStorage.getItem(
            'absorbio_guest_stats'
          );
          if (savedGuestData) {
            setUserData(JSON.parse(savedGuestData));
          } else {
            setUserData({
              uid: 'guest_' + Date.now(),
              level: 1,
              xp: 0,
              coins: 20,
            });
          }
          setLoading(false);
          return true;
        }
      } catch (error) {
        console.error('Error checking offline guest:', error);
      }
      return false;
    };

    const initializeAuth = async () => {
      const isOfflineGuest = await checkOfflineGuest();
      if (isOfflineGuest) return;

      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          setUser(firebaseUser);
          setIsGuest(firebaseUser.isAnonymous);

          // Load user data from Firestore
          let data = await getUserData(firebaseUser.uid);

          if (!data) {
            // Initialize new user
            data = await initializeUserData(
              firebaseUser.uid,
              firebaseUser.displayName || 'Player',
              firebaseUser.email || '',
              firebaseUser.providerData[0]?.providerId || 'anonymous'
            );
          }

          setUserData(data);
        } else {
          setUser(null);
          setUserData(null);
          setIsGuest(false);
        }
        setLoading(false);
      });

      return () => unsubscribe();
    };

    initializeAuth();
  }, []);

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;

      let data = await getUserData(firebaseUser.uid);
      if (!data) {
        data = await initializeUserData(
          firebaseUser.uid,
          firebaseUser.displayName || 'Player',
          firebaseUser.email || '',
          'google'
        );
      }

      setUser(firebaseUser);
      setUserData(data);
      setIsGuest(false);
      await AsyncStorage.removeItem('absorbio_offline_guest');
    } catch (error) {
      console.error('Google sign-in error:', error);
      throw error;
    }
  };

  const signInWithFacebook = async () => {
    try {
      const result = await signInWithPopup(auth, facebookProvider);
      const firebaseUser = result.user;

      let data = await getUserData(firebaseUser.uid);
      if (!data) {
        data = await initializeUserData(
          firebaseUser.uid,
          firebaseUser.displayName || 'Player',
          firebaseUser.email || '',
          'facebook'
        );
      }

      setUser(firebaseUser);
      setUserData(data);
      setIsGuest(false);
      await AsyncStorage.removeItem('absorbio_offline_guest');
    } catch (error) {
      console.error('Facebook sign-in error:', error);
      throw error;
    }
  };

  const signInAsGuest = async () => {
    try {
      // Try online anonymous sign-in first
      const result = await signInAnonymously(auth);
      setUser(result.user);
      setIsGuest(true);
      setUserData({
        uid: result.user.uid,
        level: 1,
        xp: 0,
        coins: 20,
      });
      await AsyncStorage.removeItem('absorbio_offline_guest');
    } catch (error) {
      // Fall back to offline guest
      console.warn('Online guest sign-in failed, using offline mode:', error);
      await AsyncStorage.setItem('absorbio_offline_guest', 'true');
      setIsGuest(true);
      setUserData({
        uid: 'guest_' + Date.now(),
        level: 1,
        xp: 0,
        coins: 20,
      });
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserData(null);
      setIsGuest(false);
      await AsyncStorage.removeItem('absorbio_offline_guest');
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  const refreshUserData = async () => {
    if (!user) return;
    const data = await getUserData(user.uid);
    if (data) {
      setUserData(data);
    }
  };

  const value: AuthContextType = {
    user,
    userData,
    loading,
    isGuest,
    signInWithGoogle,
    signInWithFacebook,
    signInAsGuest,
    logout,
    refreshUserData,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
