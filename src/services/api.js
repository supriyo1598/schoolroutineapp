// API Service for School Routine Software
// This service handles all data persistence. 
// It currently uses localStorage as a fallback but is structured to use a global backend (like Supabase).

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isSupabaseConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

// Helper for Supabase requests
async function sbRequest(path, options = {}) {
  // Ensure we trim whitespace from env vars
  const cleanUrl = SUPABASE_URL?.trim();
  const cleanKey = SUPABASE_ANON_KEY?.trim();
  
  if (!cleanUrl) throw new Error('SUPABASE_URL is not defined');
  
  const url = `${cleanUrl}/rest/v1/${path}`;
  const headers = {
    'apikey': cleanKey,
    'Authorization': `Bearer ${cleanKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...(options.headers || {})
  };

  console.log(`Supabase Request: ${options.method || 'GET'} ${url}`);

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    let errorMessage = 'Supabase request failed';
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
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
              createdAt: u.created_at
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
            created_at: u.createdAt
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
          created_at: user.createdAt
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
         if (updates.assignedClasses) {
           mappedUpdates.assigned_classes = updates.assignedClasses;
           delete mappedUpdates.assignedClasses;
         }
         if (updates.createdAt) {
           mappedUpdates.created_at = updates.createdAt;
           delete mappedUpdates.createdAt;
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
      return JSON.parse(localStorage.getItem('srs_schedule_data') || 'null');
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
  }
};

export default api;
