/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const LeaveContext = createContext(null);

export function LeaveProvider({ children }) {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshLeaves = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.leaves.getAll();
      setLeaves(data);
      return data;
    } catch (err) {
      console.error('Failed to load leaves:', err);
      throw err;
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    refreshLeaves();
    // Poll every 30 seconds for new requests while the app is open
    const interval = setInterval(() => refreshLeaves(true), 30000);
    return () => clearInterval(interval);
  }, []);

  async function applyLeave(teacherId, teacherName, day, reason) {
    const newLeave = {
      id: 'leave_' + Date.now(),
      teacher_id: teacherId,
      teacher_name: teacherName,
      day,
      reason,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    
    // Optimistic update
    setLeaves(prev => [newLeave, ...prev]);
    
    try {
      await api.leaves.create(newLeave);
    } catch (err) {
      // Revert if failed
      setLeaves(prev => prev.filter(l => l.id !== newLeave.id));
      throw err;
    }
    return newLeave;
  }

  async function updateLeaveStatus(leaveId, status) {
    const oldLeaves = [...leaves];
    setLeaves(prev => prev.map(l => l.id === leaveId ? { ...l, status } : l));
    
    try {
      await api.leaves.update(leaveId, { status });
    } catch (err) {
      setLeaves(oldLeaves);
      throw err;
    }
  }

  return (
    <LeaveContext.Provider value={{
      leaves, loading, applyLeave, updateLeaveStatus, refreshLeaves
    }}>
      {children}
    </LeaveContext.Provider>
  );
}

export function useLeave() {
  return useContext(LeaveContext);
}
