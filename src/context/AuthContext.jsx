import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

const ADMIN_CREDENTIALS = { username: 'admin', password: 'admin123', role: 'admin', name: 'Administrator' };

const SESSION_KEY = 'srs_session';

export function AuthProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
    catch { return null; }
  });

  // Initial load
  useEffect(() => {
    async function loadData() {
      try {
        const data = await api.users.getAll();
        setUsers(data);
      } catch (err) {
        console.error('Failed to load users:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Save session to localStorage (still needed for staying logged in on refresh)
  useEffect(() => {
    if (currentUser) localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
    else localStorage.removeItem(SESSION_KEY);
  }, [currentUser]);

  async function login(username, password) {
    // Admin login
    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
      const user = { ...ADMIN_CREDENTIALS };
      setCurrentUser(user);
      return { success: true, user };
    }
    // Teacher login
    const teacher = users.find(u => u.username === username && u.password === password);
    if (!teacher) return { success: false, error: 'Invalid credentials.' };
    if (teacher.status === 'pending') return { success: false, error: 'pending', user: teacher };
    if (teacher.status === 'rejected') return { success: false, error: 'Your registration was rejected by admin.' };
    setCurrentUser(teacher);
    return { success: true, user: teacher };
  }

  async function register(data) {
    if (data.username === ADMIN_CREDENTIALS.username) return { success: false, error: 'Username not available.' };
    if (users.find(u => u.username === data.username)) return { success: false, error: 'Username already exists.' };
    
    const newUser = {
      id: 'teacher_' + Date.now(),
      role: 'teacher',
      status: 'pending',
      name: data.name,
      username: data.username,
      password: data.password,
      email: data.email,
      phone: data.phone || '',
      subjects: [],
      classes: [],
      createdAt: new Date().toISOString(),
    };

    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    await api.users.create(newUser);
    return { success: true, user: newUser };
  }

  async function approveUser(userId) {
    const updatedUsers = users.map(u => u.id === userId ? { ...u, status: 'approved' } : u);
    setUsers(updatedUsers);
    await api.users.update(userId, { status: 'approved' });
  }

  async function rejectUser(userId) {
    const updatedUsers = users.map(u => u.id === userId ? { ...u, status: 'rejected' } : u);
    setUsers(updatedUsers);
    await api.users.update(userId, { status: 'rejected' });
  }

  async function deleteUser(userId) {
    const updatedUsers = users.filter(u => u.id !== userId);
    setUsers(updatedUsers);
    await api.users.delete(userId);
  }

  async function updateTeacher(teacherId, updates) {
    const updatedUsers = users.map(u => u.id === teacherId ? { ...u, ...updates } : u);
    setUsers(updatedUsers);
    await api.users.update(teacherId, updates);
    
    if (currentUser?.id === teacherId) {
      setCurrentUser(prev => ({ ...prev, ...updates }));
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

  return (
    <AuthContext.Provider value={{
      currentUser, users, loading, login, register, logout,
      approveUser, rejectUser, deleteUser, updateTeacher,
      getApprovedTeachers, getAllTeachers,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
