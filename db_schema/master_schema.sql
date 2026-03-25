-- ============================================================
-- MASTER SCHEMA AND SETUP (Simplified)
-- Use this script to set up the entire database from scratch
-- or to fix/reset all tables and permissions.
-- ============================================================

-- 1. BASE TABLES
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  full_name text,
  email text,
  role_id uuid REFERENCES roles(id),
  is_banned boolean DEFAULT false,
  avatar_url text,
  instance_url text DEFAULT 'local',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE
);

CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  department_id uuid REFERENCES departments(id) ON DELETE CASCADE,
  duration_semesters int DEFAULT 8
);

CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  is_common boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  type text CHECK (type IN ('notes','question_paper','assignment','reference','other')),
  subject_id uuid REFERENCES subjects(id),
  file_url text NOT NULL,
  file_type text,
  uploaded_by uuid REFERENCES profiles(id),
  verified_by uuid REFERENCES profiles(id),
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  is_common bool DEFAULT false,
  download_count int DEFAULT 0,
  upvotes int DEFAULT 0,
  instance_url text DEFAULT 'local',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  requested_by uuid REFERENCES profiles(id),
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  payload jsonb,
  reviewed_by uuid REFERENCES profiles(id),
  review_note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. SEED DATA
-- ============================================================
INSERT INTO roles (name) 
VALUES ('admin'), ('teacher'), ('verifier'), ('student')
ON CONFLICT (name) DO NOTHING;

-- 3. CORE FUNCTIONS
-- ============================================================

-- Handle new user registration and link to profiles
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, email, role_id)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'full_name',
    new.email,
    (SELECT id FROM public.roles WHERE name = 'student')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Safe trigger creation
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE PROCEDURE handle_new_user();
  END IF;
END $$;

-- Statistics Functions
CREATE OR REPLACE FUNCTION increment_download(row_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE materials SET download_count = download_count + 1 WHERE id = row_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_upvote(row_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE materials SET upvotes = upvotes + 1 WHERE id = row_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. ROW LEVEL SECURITY (Final Master Policies)
-- ============================================================

-- A. ROLES & PROFILES (Must be readable for JOINs in other policies)
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Roles are readable by everyone" ON roles;
CREATE POLICY "Roles are readable by everyone" ON roles FOR SELECT USING (true);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profiles are readable by authenticated" ON profiles;
CREATE POLICY "Profiles are readable by authenticated" ON profiles FOR SELECT USING (auth.role() = 'authenticated');

-- Allow users to update their own profile; admins/teachers can update any profile (e.g. to promote roles)
DROP POLICY IF EXISTS "Profiles update policy" ON profiles;
CREATE POLICY "Profiles update policy" ON profiles FOR UPDATE USING (
  auth.uid() = id
  OR EXISTS (
    SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id
    WHERE p.id = auth.uid() AND r.name IN ('admin', 'teacher')
  )
);

-- 4.B MATERIALS
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

-- Select
DROP POLICY IF EXISTS "materials_select" ON materials;
CREATE POLICY "materials_select" ON materials FOR SELECT USING (
  status = 'approved' 
  OR auth.uid() = uploaded_by 
  OR EXISTS (
    SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id 
    WHERE p.id = auth.uid() AND r.name IN ('admin', 'teacher', 'verifier')
  )
);

-- Insert
DROP POLICY IF EXISTS "materials_insert" ON materials;
CREATE POLICY "materials_insert" ON materials FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Update
DROP POLICY IF EXISTS "materials_update" ON materials;
CREATE POLICY "materials_update" ON materials FOR UPDATE USING (
  auth.uid() = uploaded_by 
  OR EXISTS (
    SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id 
    WHERE p.id = auth.uid() AND r.name IN ('admin', 'teacher', 'verifier')
  )
);

-- Delete
DROP POLICY IF EXISTS "materials_delete" ON materials;
CREATE POLICY "materials_delete" ON materials FOR DELETE USING (
  auth.uid() = uploaded_by 
  OR EXISTS (
    SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id 
    WHERE p.id = auth.uid() AND r.name IN ('admin', 'teacher')
  )
);

-- C. REQUESTS
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Requests view policy" ON requests;
CREATE POLICY "Requests view policy" ON requests
FOR SELECT USING (
  auth.uid() = requested_by
  OR EXISTS (
    SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id 
    WHERE p.id = auth.uid() AND r.name IN ('admin', 'teacher')
  )
);

DROP POLICY IF EXISTS "Requests update policy" ON requests;
CREATE POLICY "Requests update policy" ON requests
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles p JOIN roles r ON p.role_id = r.id 
    WHERE p.id = auth.uid() AND r.name IN ('admin', 'teacher')
  )
);

DROP POLICY IF EXISTS "Requests insert policy" ON requests;
CREATE POLICY "Requests insert policy" ON requests FOR INSERT WITH CHECK (auth.uid() = requested_by);

-- 5. PERFORMANCE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_materials_status ON materials(status);
CREATE INDEX IF NOT EXISTS idx_materials_created_at ON materials(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
