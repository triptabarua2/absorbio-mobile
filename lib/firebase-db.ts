import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  increment,
  arrayUnion,
  query,
  collection,
  orderBy,
  limit,
  getDocs,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export interface UserData {
  uid: string;
  name?: string;
  email?: string;
  level: number;
  xp: number;
  coins: number;
  provider?: string;
  createdAt?: any;
  inventory?: {
    magnet?: number;
    speed?: number;
    double?: number;
  };
}

/**
 * Save or update user data in Firestore
 */
export const saveUserData = async (uid: string, data: Partial<UserData>) => {
  if (!uid) return;
  const userRef = doc(db, 'absorbio_users', uid);
  try {
    await setDoc(userRef, data, { merge: true });
  } catch (error) {
    console.error('Error saving user data:', error);
    throw error;
  }
};

/**
 * Get user data from Firestore
 */
export const getUserData = async (uid: string): Promise<UserData | null> => {
  if (!uid) return null;
  const userRef = doc(db, 'absorbio_users', uid);
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserData;
    }
  } catch (error) {
    console.error('Error getting user data:', error);
  }
  return null;
};

/**
 * Update user stats (XP and coins)
 */
export const updateStats = async (
  uid: string,
  xpGain: number,
  coinGain: number
) => {
  if (!uid) return;
  const userRef = doc(db, 'absorbio_users', uid);
  try {
    await updateDoc(userRef, {
      xp: increment(xpGain),
      coins: increment(coinGain),
    });
  } catch (error) {
    console.error('Error updating stats:', error);
    throw error;
  }
};

/**
 * Update user level
 */
export const updateLevel = async (uid: string, newLevel: number) => {
  if (!uid) return;
  const userRef = doc(db, 'absorbio_users', uid);
  try {
    await updateDoc(userRef, {
      level: newLevel,
    });
  } catch (error) {
    console.error('Error updating level:', error);
    throw error;
  }
};

/**
 * Update user inventory
 */
export const updateInventory = async (
  uid: string,
  category: string,
  itemId: string
) => {
  if (!uid) return;
  const userRef = doc(db, 'absorbio_users', uid);
  try {
    await updateDoc(userRef, {
      [`inventory.${category}`]: arrayUnion(itemId),
    });
  } catch (error) {
    console.error('Error updating inventory:', error);
    throw error;
  }
};

/**
 * Get top leaderboard players
 */
export const getLeaderboard = async (
  limitCount: number = 100
): Promise<UserData[]> => {
  try {
    const usersRef = collection(db, 'absorbio_users');
    const q = query(
      usersRef,
      orderBy('level', 'desc'),
      orderBy('xp', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as UserData);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }
};

/**
 * Search for a user by name
 */
export const searchUser = async (name: string): Promise<UserData | null> => {
  try {
    const usersRef = collection(db, 'absorbio_users');
    const q = query(usersRef, where('name', '==', name), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.docs.length > 0) {
      return snapshot.docs[0].data() as UserData;
    }
  } catch (error) {
    console.error('Error searching user:', error);
  }
  return null;
};

/**
 * Initialize new user data
 */
export const initializeUserData = async (
  uid: string,
  name: string,
  email: string,
  provider: string
): Promise<UserData> => {
  const userData: UserData = {
    uid,
    name,
    email,
    level: 1,
    xp: 0,
    coins: 50,
    provider,
    createdAt: serverTimestamp(),
    inventory: {
      magnet: 0,
      speed: 0,
      double: 0,
    },
  };

  await saveUserData(uid, userData);
  return userData;
};
