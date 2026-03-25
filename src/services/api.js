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
          if (data && data.length > 0) return data;
        } catch (err) {
          console.error('Supabase user fetch failed, falling back to local:', err);
        }
      }
      return JSON.parse(localStorage.getItem('srs_users') || '[]');
    },
    async saveAll(users) {
      if (isSupabaseConfigured) {
        try {
          await sbRequest('users?on_conflict=id', {
            method: 'POST',
            headers: { 'Prefer': 'resolution=merge-duplicates' },
            body: JSON.stringify(users),
          });
        } catch (err) {
          console.error('Supabase users sync failed:', err);
        }
      }
      localStorage.setItem('srs_users', JSON.stringify(users));
    },
    async create(user) {
      if (isSupabaseConfigured) {
        try {
          return await sbRequest('users', {
            method: 'POST',
            body: JSON.stringify(user),
          });
        } catch (err) {
          console.error('Supabase user creation failed:', err);
        }
      }
      const users = await this.getAll();
      localStorage.setItem('srs_users', JSON.stringify([...users, user]));
    },
    async update(id, updates) {
       if (isSupabaseConfigured) {
         try {
           return await sbRequest(`users?id=eq.${id}`, {
             method: 'PATCH',
             body: JSON.stringify(updates),
           });
         } catch (err) {
           console.error('Supabase user update failed:', err);
         }
       }
       const users = await this.getAll();
       const updated = users.map(u => u.id === id ? { ...u, ...updates } : u);
       localStorage.setItem('srs_users', JSON.stringify(updated));
    },
    async delete(id) {
       if (isSupabaseConfigured) {
         try {
           return await sbRequest(`users?id=eq.${id}`, { method: 'DELETE' });
         } catch (err) {
           console.error('Supabase user deletion failed:', err);
         }
       }
       const users = await this.getAll();
       localStorage.setItem('srs_users', JSON.stringify(users.filter(u => u.id !== id)));
    }
  },

  // --- SCHEDULE ---
  schedule: {
    async get() {
      if (isSupabaseConfigured) {
        try {
          const data = await sbRequest('app_state?key=eq.schedule_data&select=value');
          if (data && data[0]?.value) return data[0].value;
        } catch (err) {
          console.error('Supabase schedule fetch failed, falling back to local:', err);
        }
      }
      return JSON.parse(localStorage.getItem('srs_schedule_data') || 'null');
    },
    async save(data) {
      if (isSupabaseConfigured) {
        try {
          await sbRequest('app_state?on_conflict=key', {
            method: 'POST',
            headers: { 'Prefer': 'resolution=merge-duplicates' },
            body: JSON.stringify({ key: 'schedule_data', value: data }),
          });
        } catch (err) {
          console.error('Supabase schedule save failed:', err);
          throw err;
        }
      }
      localStorage.setItem('srs_schedule_data', JSON.stringify(data));
    }
  },

  // --- NOTIFICATIONS ---
  notifications: {
    async get() {
      if (isSupabaseConfigured) {
        try {
          const data = await sbRequest('notifications?select=*&order=timestamp.desc');
          if (data && data.length > 0) return data;
        } catch (err) {
          console.error('Supabase notifications fetch failed, falling back to local:', err);
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
          if (data) return data;
        } catch (err) {
          console.error('Supabase leave applications fetch failed, falling back to local:', err);
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
