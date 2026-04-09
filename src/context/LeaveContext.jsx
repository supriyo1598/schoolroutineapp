/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';


const LeaveContext = createContext(null);

export function LeaveProvider({ children }) {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const { updateUser, users } = useAuth();


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

  async function applyLeave(teacherId, teacherName, day, reason, documentLink = '', leaveDate = '') {
    const newLeave = {
      id: 'leave_' + Date.now(),
      teacher_id: teacherId,
      teacher_name: teacherName,
      day,
      reason,
      document_link: documentLink,
      leave_date: leaveDate,
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
    const leaf = leaves.find(l => l.id === leaveId);
    setLeaves(prev => prev.map(l => l.id === leaveId ? { ...l, status } : l));
    
    try {
      await api.leaves.update(leaveId, { status });
      
      // If approved, deduct 1 CL from teacher
      if (status === 'approved' && leaf) {
        const teacher = users.find(u => u.id === leaf.teacher_id);
        if (teacher) {
          const newRemaining = Math.max(0, (teacher.remainingCl || 0) - 1);
          await updateUser(teacher.id, { remainingCl: newRemaining });
        }
      }
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
