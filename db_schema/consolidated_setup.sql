-- ============================================================
-- SAFE MASTER SETUP & UPDATE
-- This script can be run multiple times without errors.
-- It handles existing tables, policies, and functions.
-- ============================================================

-- 1. TABLES (Using IF NOT EXISTS)
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
  common_departments uuid[],
  common_semesters int[],
  download_count int DEFAULT 0,
  upvotes int DEFAULT 0,
  version int DEFAULT 1,
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

-- 2. SEED DATA (Using ON CONFLICT)
-- ============================================================
INSERT INTO roles (name) 
VALUES ('admin'), ('teacher'), ('verifier'), ('student')
ON CONFLICT (name) DO NOTHING;

-- 3. FUNCTIONS & TRIGGERS
-- ============================================================
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

-- Increment Functions
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

-- 4. POLICIES (Drop and Re-create for Clean Slate)
-- ============================================================

-- Materials
DROP POLICY IF EXISTS "Materials are viewable by everyone" ON materials;
CREATE POLICY "Materials are viewable by everyone" ON materials 
FOR SELECT USING (
  status = 'approved' 
  OR auth.uid() = uploaded_by 
  OR EXISTS (
    SELECT 1 FROM profiles 
    JOIN roles ON profiles.role_id = roles.id 
    WHERE profiles.id = auth.uid() AND roles.name IN ('admin', 'teacher', 'verifier')
  )
);

DROP POLICY IF EXISTS "Admins can manage materials" ON materials;
CREATE POLICY "Admins can manage materials" ON materials 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles 
    JOIN roles ON profiles.role_id = roles.id 
    WHERE profiles.id = auth.uid() AND roles.name = 'admin'
  )
);

DROP POLICY IF EXISTS "Management can update materials" ON materials;
CREATE POLICY "Management can update materials" ON materials
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    JOIN roles ON profiles.role_id = roles.id 
    WHERE profiles.id = auth.uid() AND roles.name IN ('admin', 'teacher', 'verifier')
  )
);

-- Requests
DROP POLICY IF EXISTS "Requests are viewable by management" ON requests;
CREATE POLICY "Requests are viewable by management" ON requests
FOR SELECT USING (
  auth.uid() = requested_by
  OR EXISTS (
    SELECT 1 FROM profiles 
    JOIN roles ON profiles.role_id = roles.id 
    WHERE profiles.id = auth.uid() AND roles.name IN ('admin', 'teacher')
  )
);

DROP POLICY IF EXISTS "Management can update requests" ON requests;
CREATE POLICY "Management can update requests" ON requests
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    JOIN roles ON profiles.role_id = roles.id 
    WHERE profiles.id = auth.uid() AND roles.name IN ('admin', 'teacher')
  )
);

DROP POLICY IF EXISTS "Anyone can create requests" ON requests;
CREATE POLICY "Anyone can create requests" ON requests
FOR INSERT WITH CHECK (
  auth.uid() = requested_by
);

-- Profiles
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
CREATE POLICY "Admins can update all profiles" ON profiles
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    JOIN roles ON profiles.role_id = roles.id 
    WHERE profiles.id = auth.uid() AND roles.name = 'admin'
  )
);


-- 5. PERFORMANCE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_materials_status ON materials(status);
CREATE INDEX IF NOT EXISTS idx_materials_uploaded_by ON materials(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_materials_created_at ON materials(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
