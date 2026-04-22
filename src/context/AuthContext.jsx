import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

const SUPER_ADMIN_CREDENTIALS = { 
  username: 'superadmin', 
  password: 'superadmin123', 
  role: 'super_admin', 
  name: 'Super Administrator' 
};

const SESSION_KEY = 'srs_session';

export function AuthProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
    catch { return null; }
  });

  const loadUsers = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const data = await api.users.getAll();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Background Polling (30s)
  useEffect(() => {
    const interval = setInterval(() => {
      loadUsers(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [loadUsers]);

  // Refresh on Focus
  useEffect(() => {
    const handleFocus = () => loadUsers(true);
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadUsers]);

  // Save session to localStorage (still needed for staying logged in on refresh)
  useEffect(() => {
    if (currentUser) localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
    else localStorage.removeItem(SESSION_KEY);
  }, [currentUser]);

  async function login(username, password) {
    // 1. Super Admin login
    if (username === SUPER_ADMIN_CREDENTIALS.username && password === SUPER_ADMIN_CREDENTIALS.password) {
      const user = { ...SUPER_ADMIN_CREDENTIALS };
      setCurrentUser(user);
      return { success: true, user };
    }
    
    // 2. Check local state first
    let user = users.find(u => u.username === username && u.password === password);
    
    // 3. Robust Login: If not found, try re-fetching from API (prevents issues with stale state)
    if (!user) {
      try {
        const freshUsers = await api.users.getAll();
        setUsers(freshUsers);
        user = freshUsers.find(u => u.username === username && u.password === password);
      } catch (err) {
        console.error('Robust login fetch failed:', err);
      }
    }

    if (!user) return { success: false, error: 'Invalid credentials.' };
    
    // For teachers, check status
    if (user.role === 'teacher') {
      if (user.status === 'pending') return { success: false, error: 'pending', user };
      if (user.status === 'rejected') return { success: false, error: 'Your registration was rejected by admin.' };
    }
    
    setCurrentUser(user);
    return { success: true, user };
  }

  async function register(data) {
    if (data.username === SUPER_ADMIN_CREDENTIALS.username) return { success: false, error: 'Username not available.' };
    if (users.find(u => u.username === data.username)) return { success: false, error: 'Username already exists.' };
    
    const newUser = {
      id: 'user_' + Date.now(),
      role: 'teacher',
      status: 'pending',
      name: data.name,
      username: data.username,
      password: data.password,
      email: data.email,
      phone: data.phone || '',
      subjects: [],
      classes: [],
      assignedClasses: [],
      createdAt: new Date().toISOString(),
      totalCl: 0,
      remainingCl: 0,
      branchId: null,
    };

    try {
      await api.users.create(newUser);
      const freshUsers = await api.users.getAll();
      setUsers(freshUsers);
      return { success: true, user: newUser };
    } catch (err) {
      return { success: false, error: 'Failed to save account. Please try again.' };
    }
  }

  // Super Admin only: Create a new account with a specific role
  async function createUserAccount(data) {
    if (data.username === SUPER_ADMIN_CREDENTIALS.username) return { success: false, error: 'Username not available.' };
    if (users.find(u => u.username === data.username)) return { success: false, error: 'Username already exists.' };

    const newUser = {
      id: 'user_' + Date.now(),
      role: data.role || 'teacher',
      status: data.role === 'admin' ? 'approved' : 'pending',
      name: data.name,
      username: data.username,
      password: data.password,
      email: data.email || '',
      phone: data.phone || '',
      subjects: data.subjects || [],
      classes: data.classes || [],
      assignedClasses: data.assignedClasses || [],
      createdAt: new Date().toISOString(),
      totalCl: data.totalCl ?? 0,
      remainingCl: data.remainingCl ?? data.totalCl ?? 0,
      branchId: data.branchId || null,
    };

    try {
      await api.users.create(newUser);
      const freshUsers = await api.users.getAll();
      setUsers(freshUsers);
      return { success: true, user: newUser };
    } catch (err) {
      console.error('Failed to create user account:', err);
      return { success: false, error: err.message || 'Failed to create user account.' };
    }
  }

  async function approveUser(userId) {
    await api.users.update(userId, { status: 'approved' });
    loadUsers(true);
  }

  async function rejectUser(userId) {
    await api.users.update(userId, { status: 'rejected' });
    loadUsers(true);
  }

  async function deleteUser(userId) {
    const originalUsers = [...users];
    // Optimistic update
    setUsers(users.filter(u => u.id !== userId));
    
    try {
      await api.users.delete(userId);
    } catch (err) {
      // Rollback if server fail
      setUsers(originalUsers);
      throw err;
    }
  }

  async function updateUser(userId, updates) {
    try {
      await api.users.update(userId, updates);
      // Re-fetch everything to ensure all browsers/sessions are in sync with the DB truth
      const freshUsers = await api.users.getAll();
      setUsers(freshUsers);
      
      if (currentUser?.id === userId) {
        const updatedSelf = freshUsers.find(u => u.id === userId);
        if (updatedSelf) setCurrentUser(updatedSelf);
      }
      return { success: true };
    } catch (err) {
      console.error('Failed to update user:', err);
      throw err;
    }
  }

  function logout() {
    setCurrentUser(null);
  }

  function getApprovedTeachers() {
    return users.filter(u => u.role === 'teacher' && u.status === 'approved');
  }

  function getAllTeachers() {
    return users.filter(u => u.role === 'teacher');
  }

  function getAllAdmins() {
    return users.filter(u => u.role === 'admin');
  }

  return (
    <AuthContext.Provider value={{
      currentUser, users, loading, login, register, logout,
      approveUser, rejectUser, deleteUser, updateUser, createUserAccount,
      getApprovedTeachers, getAllTeachers, getAllAdmins,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

