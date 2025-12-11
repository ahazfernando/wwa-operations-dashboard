import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export type UserRole = 'admin' | 'operationsstaff' | 'itteam';
export type UserStatus = 'pending' | 'approved' | 'rejected' | 'terminated';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  permissions?: {
    leadTracking?: 'read' | 'crud';
  };
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, firstName: string, lastName: string, employeeId: string) => Promise<void>;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithGithub: () => Promise<void>;
  approveUser: (userId: string, role: UserRole) => Promise<void>;
  rejectUser: (userId: string) => Promise<void>;
  terminateUser: (userId: string) => Promise<void>;
  reapproveTerminatedUser: (userId: string, role: UserRole) => Promise<void>;
  getPendingUsers: () => Promise<any[]>;
  getAllUsers: () => Promise<any[]>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function to get user data from Firestore
async function getUserDataFromFirestore(uid: string): Promise<{ role: UserRole; status: UserStatus; permissions?: any }> {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your environment variables.');
  }
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return {
        role: (userData.role as UserRole) || 'itteam',
        status: (userData.status as UserStatus) || 'pending',
        permissions: userData.permissions || undefined,
      };
    }
    return { role: 'itteam', status: 'pending' };
  } catch (error) {
    console.error('Error fetching user data:', error);
    return { role: 'itteam', status: 'pending' };
  }
}

// Helper function to convert Firebase user to app User
async function convertFirebaseUser(firebaseUser: FirebaseUser): Promise<User> {
  const { role, status, permissions } = await getUserDataFromFirestore(firebaseUser.uid);
  return {
    id: firebaseUser.uid,
    email: firebaseUser.email || '',
    name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
    role,
    status,
    permissions: permissions,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const appUser = await convertFirebaseUser(firebaseUser);
          setUser(appUser);
        } catch (error) {
          console.error('Error converting Firebase user:', error);
          setUser(null);
        }
      } else {
        setUser(null);
    }
    setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    if (!auth) {
      throw new Error('Firebase is not initialized. Please check your environment variables.');
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // User state will be updated by onAuthStateChanged
    } catch (error: any) {
      throw new Error(error.message || 'Failed to sign in');
    }
  };

  const signup = async (email: string, password: string, firstName: string, lastName: string, employeeId: string) => {
    if (!auth || !db) {
      throw new Error('Firebase is not initialized. Please check your environment variables.');
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Update display name
      await updateProfile(firebaseUser, {
        displayName: `${firstName} ${lastName}`,
      });

      // Create user document in Firestore with pending status
      await setDoc(doc(db, 'users', firebaseUser.uid), {
        email,
        firstName,
        lastName,
        employeeId,
        name: `${firstName} ${lastName}`,
        role: 'itteam', // Default role - admin will assign proper role on approval
        status: 'pending', // New users start as pending
        createdAt: serverTimestamp(),
      });

      // User state will be updated by onAuthStateChanged
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create account');
    }
  };

  const logout = async () => {
    if (!auth) {
      throw new Error('Firebase is not initialized. Please check your environment variables.');
    }
    try {
      await firebaseSignOut(auth);
      // User state will be updated by onAuthStateChanged
    } catch (error: any) {
      throw new Error(error.message || 'Failed to sign out');
    }
  };

  const signInWithGoogle = async () => {
    if (!auth || !db) {
      throw new Error('Firebase is not initialized. Please check your environment variables.');
    }
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Check if user document exists, create if not
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', result.user.uid), {
          email: result.user.email,
          name: result.user.displayName || result.user.email?.split('@')[0] || 'User',
          role: 'itteam', // Default role
          status: 'pending', // New users start as pending
          createdAt: serverTimestamp(),
        });
      }
      // User state will be updated by onAuthStateChanged
    } catch (error: any) {
      throw new Error(error.message || 'Failed to sign in with Google');
    }
  };

  const signInWithGithub = async () => {
    if (!auth || !db) {
      throw new Error('Firebase is not initialized. Please check your environment variables.');
    }
    try {
      const provider = new GithubAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Check if user document exists, create if not
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', result.user.uid), {
          email: result.user.email,
          name: result.user.displayName || result.user.email?.split('@')[0] || 'User',
          role: 'itteam', // Default role
          status: 'pending', // New users start as pending
          createdAt: serverTimestamp(),
        });
      }
      // User state will be updated by onAuthStateChanged
    } catch (error: any) {
      throw new Error(error.message || 'Failed to sign in with GitHub');
    }
  };

  const approveUser = async (userId: string, role: UserRole) => {
    if (!auth || !db) {
      throw new Error('Firebase is not initialized. Please check your environment variables.');
    }
    try {
      const currentUser = auth.currentUser;
      await updateDoc(doc(db, 'users', userId), {
        status: 'approved',
        role,
        approvedAt: serverTimestamp(),
        approvedBy: currentUser?.uid || null,
        approvedByName: currentUser?.displayName || currentUser?.email || 'Admin',
      });
      // Refresh current user if it's the same user
      if (currentUser?.uid === userId) {
        const appUser = await convertFirebaseUser(currentUser);
        setUser(appUser);
      }
    } catch (error: any) {
      throw new Error(error.message || 'Failed to approve user');
    }
  };

  const rejectUser = async (userId: string) => {
    if (!db) {
      throw new Error('Firebase is not initialized. Please check your environment variables.');
    }
    try {
      await updateDoc(doc(db, 'users', userId), {
        status: 'rejected',
        rejectedAt: serverTimestamp(),
      });
    } catch (error: any) {
      throw new Error(error.message || 'Failed to reject user');
    }
  };

  const terminateUser = async (userId: string) => {
    if (!auth || !db) {
      throw new Error('Firebase is not initialized. Please check your environment variables.');
    }
    try {
      const currentUser = auth.currentUser;
      await updateDoc(doc(db, 'users', userId), {
        status: 'terminated',
        terminatedAt: serverTimestamp(),
        terminatedBy: currentUser?.uid || null,
        terminatedByName: currentUser?.displayName || currentUser?.email || 'Admin',
        // Remove approval so they need to be re-approved to log back in
        approvedAt: null,
        approvedBy: null,
        approvedByName: null,
      });
    } catch (error: any) {
      throw new Error(error.message || 'Failed to terminate user');
    }
  };

  const reapproveTerminatedUser = async (userId: string, role: UserRole) => {
    if (!auth || !db) {
      throw new Error('Firebase is not initialized. Please check your environment variables.');
    }
    try {
      const currentUser = auth.currentUser;
      await updateDoc(doc(db, 'users', userId), {
        status: 'approved',
        role,
        approvedAt: serverTimestamp(),
        approvedBy: currentUser?.uid || null,
        approvedByName: currentUser?.displayName || currentUser?.email || 'Admin',
        reapprovedAt: serverTimestamp(),
        reapprovedBy: currentUser?.uid || null,
        reapprovedByName: currentUser?.displayName || currentUser?.email || 'Admin',
      });
    } catch (error: any) {
      throw new Error(error.message || 'Failed to re-approve user');
    }
  };

  const getPendingUsers = async () => {
    if (!db) {
      throw new Error('Firebase is not initialized. Please check your environment variables.');
    }
    try {
      const q = query(collection(db, 'users'), where('status', '==', 'pending'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch pending users');
    }
  };

  const getAllUsers = async () => {
    if (!db) {
      throw new Error('Firebase is not initialized. Please check your environment variables.');
    }
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch users');
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      signup, 
      logout, 
      signInWithGoogle, 
      signInWithGithub, 
      approveUser,
      rejectUser,
      terminateUser,
      reapproveTerminatedUser,
      getPendingUsers,
      getAllUsers,
      isLoading 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    // During SSR/build, return a safe default instead of throwing
    // This prevents build-time errors while still maintaining type safety
    return {
      user: null,
      login: async () => {},
      signup: async () => {},
      logout: async () => {},
      signInWithGoogle: async () => {},
      signInWithGithub: async () => {},
      approveUser: async () => {},
      rejectUser: async () => {},
      terminateUser: async () => {},
      reapproveTerminatedUser: async () => {},
      getPendingUsers: async () => [],
      getAllUsers: async () => [],
      isLoading: true,
    } as AuthContextType;
  }
  
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
