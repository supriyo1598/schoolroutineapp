-- 1. Create 'users' table
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  role TEXT DEFAULT 'teacher',
  status TEXT DEFAULT 'pending',
  name TEXT,
  username TEXT UNIQUE,
  password TEXT,
  email TEXT,
  phone TEXT,
  subjects JSONB DEFAULT '[]',
  classes JSONB DEFAULT '[]',
  assigned_classes JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  total_cl INTEGER DEFAULT 0,
  remaining_cl FLOAT DEFAULT 0,
  branch_id TEXT
);

-- 2. Create 'notifications' table
CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY,
  type TEXT,
  message TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  unread BOOLEAN DEFAULT TRUE,
  "teacherId" TEXT
);

-- 3. Create 'app_state' table for schedules
CREATE TABLE IF NOT EXISTS public.app_state (
  key TEXT PRIMARY KEY,
  value JSONB
);

-- Enable RLS (Optional, but good for security)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;

-- Create broad policies for initial setup (Permissive)
CREATE POLICY "Allow all access" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.app_state FOR ALL USING (true) WITH CHECK (true);
-- 4. Create 'leave_applications' table
CREATE TABLE IF NOT EXISTS public.leave_applications (
  id TEXT PRIMARY KEY,
  teacher_id TEXT REFERENCES public.users(id),
  teacher_name TEXT,
  day TEXT,
  leave_date TEXT,
  document_link TEXT,
  reason TEXT,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.leave_applications ENABLE ROW LEVEL SECURITY;

-- Create broad policies
CREATE POLICY "Allow all access" ON public.leave_applications FOR ALL USING (true) WITH CHECK (true);

-- 5. Create 'branches' table
CREATE TABLE IF NOT EXISTS public.branches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  start_time TEXT NOT NULL, -- Format HH:MM (24h)
  late_threshold TEXT NOT NULL, -- Format HH:MM (24h)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create 'attendance' table
CREATE TABLE IF NOT EXISTS public.attendance (
  id TEXT PRIMARY KEY,
  teacher_id TEXT REFERENCES public.users(id),
  branch_id TEXT REFERENCES public.branches(id),
  date TEXT NOT NULL, -- Format YYYY-MM-DD
  time TEXT NOT NULL, -- Format HH:MM:SS
  status TEXT NOT NULL, -- present, late
  latitude FLOAT,
  longitude FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, date)
);

-- Enable RLS
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Create broad policies
CREATE POLICY "Allow all access" ON public.branches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.attendance FOR ALL USING (true) WITH CHECK (true);

