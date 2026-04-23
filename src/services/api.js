// API Service for School Routine Software
// This service handles all data persistence. 
// It currently uses localStorage as a fallback but is structured to use a global backend (like Supabase).

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isSupabaseConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

// Helper for Supabase requests with timeout and logging
async function sbRequest(path, options = {}) {
  const cleanUrl = SUPABASE_URL?.trim();
  const cleanKey = SUPABASE_ANON_KEY?.trim();
  
  if (!cleanUrl) {
    console.warn('Supabase URL is not configured. Falling back to local storage.');
    throw new Error('SUPABASE_URL is not defined');
  }
  
  const url = `${cleanUrl}/rest/v1/${path}`;
  const headers = {
    'apikey': cleanKey,
    'Authorization': `Bearer ${cleanKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...(options.headers || {})
  };

  // Add timeout logic
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.error(`Request timed out: ${url}`);
    controller.abort();
  }, 10000); // 10 second timeout

  try {
    console.log(`📡 Supabase Request: ${options.method || 'GET'} ${url}`);
    const response = await fetch(url, { 
      ...options, 
      headers,
      signal: controller.signal 
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(errorText || `Status: ${response.status}`);
    }

    const text = await response.text();
    const result = text ? JSON.parse(text) : null;
    console.log(`✅ Supabase Response: ${url}`, result ? 'Data received' : 'No data');
    return result;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error('Request timed out');
    console.error(`❌ Supabase Error: ${url}`, err.message);
    throw err;
  }
}

const api = {
  // --- USERS ---
  users: {
    async getAll() {
      if (isSupabaseConfigured) {
        try {
          const data = await sbRequest('users?select=*');
          if (data) {
            // Map snake_case from DB back to camelCase for app state
            const mapped = data.map(u => ({
              ...u,
              assignedClasses: u.assigned_classes || [],
              createdAt: u.created_at,
              totalCl: u.total_cl || 0,
              remainingCl: u.remaining_cl || 0,
              branchId: u.branch_id
            }));
            // Update local cache with latest from server
            localStorage.setItem('srs_users', JSON.stringify(mapped));
            return mapped;
          }
        } catch (err) {
          console.error('Supabase user fetch failed:', err);
          throw err; // Fail fast if DB is unreachable
        }
      }
      return JSON.parse(localStorage.getItem('srs_users') || '[]');
    },
    async saveAll(users) {
      localStorage.setItem('srs_users', JSON.stringify(users));
      if (isSupabaseConfigured) {
        try {
          const mappedUsers = users.map(u => ({
            id: u.id,
            role: u.role,
            status: u.status,
            name: u.name,
            username: u.username,
            password: u.password,
            email: u.email,
            phone: u.phone,
            subjects: u.subjects,
            classes: u.classes,
            assigned_classes: u.assignedClasses || [],
            created_at: u.createdAt,
            total_cl: u.totalCl || 0,
            remaining_cl: u.remainingCl || 0,
            branch_id: u.branchId
          }));
          await sbRequest('users?on_conflict=id', {
            method: 'POST',
            headers: { 'Prefer': 'resolution=merge-duplicates' },
            body: JSON.stringify(mappedUsers),
          });
        } catch (err) {
          console.error('Supabase users sync failed:', err);
        }
      }
    },
    async create(user) {
      // Always use current local state for optimistic update
      const existing = await this.getAll();
      localStorage.setItem('srs_users', JSON.stringify([...existing, user]));

      if (isSupabaseConfigured) {
        const mappedUser = {
          id: user.id,
          role: user.role,
          status: user.status,
          name: user.name,
          username: user.username,
          password: user.password,
          email: user.email,
          phone: user.phone,
          subjects: user.subjects,
          classes: user.classes,
          assigned_classes: user.assignedClasses || [],
          created_at: user.createdAt || new Date().toISOString(),
          total_cl: user.totalCl ?? 0,
          remaining_cl: user.remainingCl ?? 0,
          branch_id: user.branchId || null
        };
        // Throw error if DB create fails
        return await sbRequest('users', {
          method: 'POST',
          body: JSON.stringify(mappedUser)
        });
      }
    },
    async update(id, updates) {
       const existing = await this.getAll();
       const updated = existing.map(u => u.id === id ? { ...u, ...updates } : u);
       localStorage.setItem('srs_users', JSON.stringify(updated));

       if (isSupabaseConfigured) {
         const mappedUpdates = { ...updates };
          if (updates.assignedClasses !== undefined) {
            mappedUpdates.assigned_classes = updates.assignedClasses;
            delete mappedUpdates.assignedClasses;
          }
          if (updates.createdAt !== undefined) {
            mappedUpdates.created_at = updates.createdAt;
            delete mappedUpdates.createdAt;
          }
          if (updates.totalCl !== undefined) {
            mappedUpdates.total_cl = updates.totalCl;
            delete mappedUpdates.totalCl;
          }
          if (updates.remainingCl !== undefined) {
            mappedUpdates.remaining_cl = updates.remainingCl;
            delete mappedUpdates.remainingCl;
          }
          if (updates.branchId !== undefined) {
            mappedUpdates.branch_id = updates.branchId;
            delete mappedUpdates.branchId;
          }
         // Throw error if DB update fails
         return await sbRequest(`users?id=eq.${id}`, {
           method: 'PATCH',
           body: JSON.stringify(mappedUpdates)
         });
       }
    },
    async delete(id) {
       const users = await this.getAll();
       localStorage.setItem('srs_users', JSON.stringify(users.filter(u => u.id !== id)));

       if (isSupabaseConfigured) {
         try {
           return await sbRequest(`users?id=eq.${id}`, { method: 'DELETE' });
         } catch (err) {
           console.error('Supabase user deletion failed:', err);
           throw err;
         }
       }
    }
  },

  // --- SCHEDULE ---
  schedule: {
    async getRaw() {
      if (isSupabaseConfigured) {
        try {
          return await sbRequest('app_state?select=*');
        } catch (err) {
          console.error('Supabase raw state fetch failed:', err);
          throw err;
        }
      }
      return [];
    },
    async get() {
      if (isSupabaseConfigured) {
        try {
          const data = await sbRequest('app_state?select=*');
          if (data && data.length > 0) {
            // Find legacy key first
            const legacy = data.find(r => r.key === 'schedule_data');
            const classKeys = data.filter(r => r.key.startsWith('sch_cls_'));
            const config = data.find(r => r.key === 'sch_config');
            const absent = data.find(r => r.key === 'sch_absent');
            const substitutes = data.find(r => r.key === 'sch_substitutes');

            // Construct state by merging granular keys over legacy
            let state = legacy?.value || {};
            
            if (config?.value) {
              state = { ...state, ...config.value };
            }
            if (absent?.value) {
              state.absentTeachers = absent.value;
            }
            if (substitutes?.value) {
              state.substitutions = substitutes.value;
            }
            if (classKeys.length > 0) {
              state.schedule = state.schedule || {};
              classKeys.forEach(row => {
                const classId = row.key.replace('sch_cls_', '');
                state.schedule[classId] = row.value;
              });
            }
            
            // If we only have legacy, or if we consolidated, update local
            localStorage.setItem('srs_schedule_data', JSON.stringify(state));
            return state;
          }
        } catch (err) {
          console.error('Supabase schedule fetch failed:', err);
          throw err; // Fail fast if DB is unreachable
        }
      }
      const cached = localStorage.getItem('srs_schedule_data');
      return cached ? JSON.parse(cached) : {};
    },
    async updateKey(key, value) {
      if (isSupabaseConfigured) {
        try {
          await sbRequest('app_state?on_conflict=key', {
            method: 'POST',
            headers: { 'Prefer': 'resolution=merge-duplicates' },
            body: JSON.stringify({ key, value }),
          });
        } catch (err) {
          console.error(`Supabase schedule sync failed for key ${key}:`, err);
          throw err;
        }
      }
    },
    async save(data) {
      // Immediate local save
      localStorage.setItem('srs_schedule_data', JSON.stringify(data));

      if (isSupabaseConfigured) {
        try {
          await sbRequest('app_state?on_conflict=key', {
            method: 'POST',
            headers: { 'Prefer': 'resolution=merge-duplicates' },
            body: JSON.stringify({ key: 'schedule_data', value: data }),
          });
        } catch (err) {
          console.error('Supabase schedule save failed:', err);
          throw err; // Still throw for ScheduleContext to catch and show error status
        }
      }
    }
  },

  // --- NOTIFICATIONS ---
  notifications: {
    async get() {
      if (isSupabaseConfigured) {
        try {
          const data = await sbRequest('notifications?select=*&order=timestamp.desc');
          if (data) {
            localStorage.setItem('srs_notifications', JSON.stringify(data));
            return data;
          }
        } catch (err) {
          console.error('Supabase notifications fetch failed:', err);
          throw err;
        }
      }
      return JSON.parse(localStorage.getItem('srs_notifications') || '[]');
    },
    async save(notifications) {
      if (isSupabaseConfigured) {
        try {
          await sbRequest('notifications?on_conflict=id', {
            method: 'POST',
            headers: { 'Prefer': 'resolution=merge-duplicates' },
            body: JSON.stringify(notifications),
          });
        } catch (err) {
          console.error('Supabase notifications sync failed:', err);
        }
      }
      localStorage.setItem('srs_notifications', JSON.stringify(notifications));
    },
    async create(notification) {
      if (isSupabaseConfigured) {
        try {
          return await sbRequest('notifications', {
            method: 'POST',
            body: JSON.stringify(notification),
          });
        } catch (err) {
          console.error('Supabase notification creation failed:', err);
          throw err;
        }
      }
      const existing = await this.get();
      localStorage.setItem('srs_notifications', JSON.stringify([...existing, notification]));
    },
    async update(id, updates) {
      if (isSupabaseConfigured) {
        try {
          return await sbRequest(`notifications?id=eq.${id}`, {
            method: 'PATCH',
            body: JSON.stringify(updates),
          });
        } catch (err) {
          console.error('Supabase notification update failed:', err);
          throw err;
        }
      }
      const existing = await this.get();
      const updated = existing.map(n => n.id === id ? { ...n, ...updates } : n);
      localStorage.setItem('srs_notifications', JSON.stringify(updated));
    }
  },

  // --- LEAVES ---
  leaves: {
    async getAll() {
      if (isSupabaseConfigured) {
        try {
          const data = await sbRequest('leave_applications?select=*&order=created_at.desc');
          if (data) {
            localStorage.setItem('srs_leaves', JSON.stringify(data));
            return data;
          }
        } catch (err) {
          console.error('Supabase leave applications fetch failed:', err);
          throw err;
        }
      }
      return JSON.parse(localStorage.getItem('srs_leaves') || '[]');
    },
    async create(leaf) {
      if (isSupabaseConfigured) {
        try {
          return await sbRequest('leave_applications', {
            method: 'POST',
            body: JSON.stringify(leaf),
          });
        } catch (err) {
          console.error('Supabase leave application creation failed:', err);
          throw err;
        }
      }
      const leaves = await this.getAll();
      localStorage.setItem('srs_leaves', JSON.stringify([...leaves, leaf]));
    },
    async update(id, updates) {
      if (isSupabaseConfigured) {
        try {
          return await sbRequest(`leave_applications?id=eq.${id}`, {
            method: 'PATCH',
            body: JSON.stringify(updates),
          });
        } catch (err) {
          console.error('Supabase leave application update failed:', err);
          throw err;
        }
      }
      const leaves = await this.getAll();
      const updated = leaves.map(l => l.id === id ? { ...l, ...updates } : l);
      localStorage.setItem('srs_leaves', JSON.stringify(updated));
    },
    async delete(id) {
       if (isSupabaseConfigured) {
         try {
           return await sbRequest(`leave_applications?id=eq.${id}`, { method: 'DELETE' });
         } catch (err) {
           console.error('Supabase leave application deletion failed:', err);
         }
       }
       const leaves = await this.getAll();
       localStorage.setItem('srs_leaves', JSON.stringify(leaves.filter(l => l.id !== id)));
    }
  },

  // --- BRANCHES ---
  branches: {
    async getAll() {
      if (isSupabaseConfigured) {
        try {
          const data = await sbRequest('branches?select=*&order=name.asc');
          if (data) {
            localStorage.setItem('srs_branches', JSON.stringify(data));
            return data;
          }
        } catch (err) {
          console.error('Supabase branches fetch failed:', err);
          throw err;
        }
      }
      return JSON.parse(localStorage.getItem('srs_branches') || '[]');
    },
    async create(branch) {
      if (isSupabaseConfigured) {
        return await sbRequest('branches', {
          method: 'POST',
          body: JSON.stringify(branch),
        });
      }
      const branches = await this.getAll();
      localStorage.setItem('srs_branches', JSON.stringify([...branches, branch]));
    },
    async update(id, updates) {
      if (isSupabaseConfigured) {
        return await sbRequest(`branches?id=eq.${id}`, {
          method: 'PATCH',
          body: JSON.stringify(updates),
        });
      }
      const branches = await this.getAll();
      const updated = branches.map(b => b.id === id ? { ...b, ...updates } : b);
      localStorage.setItem('srs_branches', JSON.stringify(updated));
    },
    async delete(id) {
      if (isSupabaseConfigured) {
        return await sbRequest(`branches?id=eq.${id}`, { method: 'DELETE' });
      }
      const branches = await this.getAll();
      localStorage.setItem('srs_branches', JSON.stringify(branches.filter(b => b.id !== id)));
    }
  },

  // --- ATTENDANCE ---
  attendance: {
    async getByDate(date) {
      if (isSupabaseConfigured) {
        return await sbRequest(`attendance?date=eq.${date}&select=*`);
      }
      return [];
    },
    async getForTeacher(teacherId, month) {
      // month format: YYYY-MM
      if (isSupabaseConfigured) {
        return await sbRequest(`attendance?teacher_id=eq.${teacherId}&date=like.${month}${encodeURIComponent('%')}&select=*`);
      }
      return [];
    },
    async getAllForMonth(month) {
      // month format: YYYY-MM
      if (isSupabaseConfigured) {
        return await sbRequest(`attendance?date=like.${month}${encodeURIComponent('%')}&select=*`);
      }
      return [];
    },
    async mark(record) {
      if (isSupabaseConfigured) {
        return await sbRequest('attendance', {
          method: 'POST',
          body: JSON.stringify(record),
        });
      }
    }
  }
};


export default api;
