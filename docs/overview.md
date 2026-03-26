
# Open Learning Grid — 1-Day Build Plan (Refined for S2S Federation)

> **Purpose of this document:** This is a complete, unambiguous specification for building *Open Learning Grid* — a federated educational material management platform — using Lovable.dev + Supabase. Every section is written to eliminate guesswork for the AI builder. Follow sections in order.

---

## 1. Project Overview

**App name:** Open Learning Grid  
**Tagline:** A decentralised, federated educational material platform for colleges.  
**Core idea:** Colleges run their own "instance" of this platform. Each instance connects to other colleges by storing their public Supabase URLs. When users visit the Federation page, the app live-queries those peer databases to create a unified feed of shared educational materials.

### Four User Roles

| Role | Who they are | What they can do |
|---|---|---|
| **admin** | Platform administrator | Everything — user management, role assignment, banning, approvals, instance settings (manage peer nodes), audit logs |
| **teacher** | Faculty member | Upload & manage materials directly, verify student-uploaded notes, promote students to verifier |
| **verifier** | Trusted student | Upload materials, verify notes submitted by other students |
| **student** | Regular student | Browse & download materials, submit materials for approval, request courses/subjects, report content |

---

## 2. Recommended Stack

| Layer | Tool | Notes |
|---|---|---|
| Frontend + UI | **Lovable.dev** | React + Tailwind, native Supabase support |
| Backend / DB / Auth / Storage | **Supabase** | Postgres + Row Level Security + File Storage + Auth |
| PDF Preview | **react-pdf** | In-browser viewer; image fallback for non-PDFs |
| Federation Demo | **S2S (Supabase-to-Supabase)** | Frontend dynamically queries remote peer Supabase databases |

---

## 3. Supabase Setup (Hour 1)

1. Go to [supabase.com](https://supabase.com) → create a free project.
2. In the **SQL Editor**, run the FULL SCHEMA below. It includes all tables, RLS policies, and triggers.
3. In **Storage**, create a bucket called `materials`. 
4. Click **Configuration** on the `materials` bucket, set it to **Public**, and set the file size limit to `20MB` (.pdf, .png, .jpg).
5. Run the Storage Policies (included at the bottom of the SQL script).
6. Copy your `Project URL` and `anon public key` — you will paste these into Lovable.

### Full Database Schema (Run this in Supabase SQL Editor)

```sql
-- ============================================================
-- ROLES & PROFILES
-- ============================================================
create table roles (
  id uuid primary key default gen_random_uuid(),
  name text unique not null
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  full_name text,
  email text,
  role_id uuid references roles(id),
  is_banned boolean default false,
  avatar_url text,
  instance_url text default 'local',
  created_at timestamptz default now()
);

-- ============================================================
-- DEPARTMENTS, COURSES, SUBJECTS
-- ============================================================
create table departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique
);

create table courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  department_id uuid references departments(id) on delete cascade,
  duration_semesters int default 8
);

create table subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  is_common boolean default false
);

create table subject_departments (
  subject_id uuid references subjects(id) on delete cascade,
  department_id uuid references departments(id) on delete cascade,
  semester int not null,
  primary key (subject_id, department_id, semester)
);

-- ============================================================
-- MATERIALS & VERSIONS
-- ============================================================
create table materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  type text check (type in ('notes','question_paper','assignment','reference','other')),
  subject_id uuid references subjects(id),
  file_url text not null,
  file_type text,
  uploaded_by uuid references profiles(id),
  verified_by uuid references profiles(id),
  status text default 'pending' check (status in ('pending','approved','rejected')),
  is_common bool default false,
  common_departments uuid[],
  common_semesters int[],
  download_count int default 0,
  upvotes int default 0,
  version int default 1,
  instance_url text default 'local',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table material_versions (
  id uuid primary key default gen_random_uuid(),
  material_id uuid references materials(id) on delete cascade,
  version int not null,
  file_url text not null,
  updated_by uuid references profiles(id),
  note text,
  created_at timestamptz default now()
);

-- ============================================================
-- REQUESTS, REPORTS, NOTIFICATIONS, AUDIT LOGS
-- ============================================================
create table requests (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  requested_by uuid references profiles(id),
  status text default 'pending' check (status in ('pending','approved','rejected')),
  payload jsonb,
  reviewed_by uuid references profiles(id),
  review_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles(id),
  material_id uuid references materials(id),
  reported_user_id uuid references profiles(id),
  reason text not null,
  status text default 'open' check (status in ('open','resolved','dismissed')),
  instance_url text default 'local',
  created_at timestamptz default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  message text not null,
  is_read boolean default false,
  link text,
  created_at timestamptz default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,
  target_type text,
  target_id uuid,
  details jsonb,
  created_at timestamptz default now()
);

-- S2S Federation Table
create table federated_instances (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  supabase_url text unique not null,
  anon_key text not null,
  status text default 'active' check (status in ('active','inactive','pending')),
  added_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ============================================================
-- SEED DATA & TRIGGERS
-- ============================================================
insert into roles (name) values ('admin'), ('teacher'), ('verifier'), ('student');

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, full_name, email, role_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'full_name',
    new.email,
    (select id from public.roles where name = 'student')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY (RLS) - CRITICAL FOR LOVABLE TO WORK
-- ============================================================
alter table profiles enable row level security;
alter table materials enable row level security;
alter table requests enable row level security;
alter table notifications enable row level security;
alter table departments enable row level security;
alter table courses enable row level security;
alter table subjects enable row level security;
alter table roles enable row level security;
alter table federated_instances enable row level security;
alter table audit_logs enable row level security;

-- Roles, Departments, Courses, Subjects (Public Read)
create policy "Allow public read access to roles" on roles for select using (true);
create policy "Allow public read access to departments" on departments for select using (true);
create policy "Allow public read access to courses" on courses for select using (true);
create policy "Allow public read access to subjects" on subjects for select using (true);

-- Profiles
create policy "Public profiles are viewable by everyone" on profiles for select using (true);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- Materials
create policy "Materials are viewable by everyone" on materials for select using (status = 'approved' or auth.uid() = uploaded_by);
create policy "Authenticated users can upload" on materials for insert with check (auth.role() = 'authenticated');
create policy "Uploaders can update" on materials for update using (auth.uid() = uploaded_by);
create policy "Admins can manage materials" on materials for all using (exists (select 1 from profiles join roles on profiles.role_id = roles.id where profiles.id = auth.uid() and roles.name = 'admin'));

-- Requests & Notifications
create policy "Requests viewable by authenticated" on requests for select using (auth.role() = 'authenticated');
create policy "Users manage own requests" on requests for insert with check (auth.uid() = requested_by);
create policy "Users see own notifications" on notifications for select using (auth.uid() = user_id);

-- Federation Instances
create policy "Public read federated instances" on federated_instances for select using (true);
create policy "Admins manage instances" on federated_instances for all using (exists (select 1 from profiles join roles on profiles.role_id = roles.id where profiles.id = auth.uid() and roles.name = 'admin'));

-- Storage Policies
create policy "Public Storage Access" on storage.objects for select using ( bucket_id = 'materials' );
create policy "Auth Storage Upload" on storage.objects for insert with check ( bucket_id = 'materials' and auth.role() = 'authenticated' );

```

### The Admin Backdoor (Run AFTER creating your first account)

Once you sign up on the frontend, your role will default to `student`. To view the admin panel and prepare the demo, run this in the Supabase SQL editor:

```sql
update public.profiles 
set role_id = (select id from public.roles where name = 'muneersclassb')
where email = 'muneersclassb@gmail.com';

```

---

## 4. Lovable Master Prompt

> Copy the entire block below (from the triple-backtick to the closing triple-backtick) and paste it into Lovable's chat as the very first message.

```text
Build a full-stack web application called "Open Learning Grid". This is a federated educational material management platform for colleges. Use React + Tailwind CSS (no other CSS framework) and Supabase for all backend concerns (auth, database, file storage, realtime).

---

## CRITICAL: Role System
There are exactly four roles. Every page and every UI element must check the user's role before rendering.

| Role     | Dashboard shown    | Can upload without approval | Can approve others' uploads | Can manage users/system |
|----------|--------------------|-----------------------------|-----------------------------|--------------------------|
| admin    | Admin Panel        | YES                         | YES                         | YES (full access)        |
| teacher  | Teacher Dashboard  | YES                         | YES (notes only)            | Partial (promote verifier) |
| verifier | Verifier Dashboard | YES                         | YES (notes only)            | NO                       |
| student  | Student Dashboard  | NO (goes to pending)        | NO                          | NO                       |

Unauthenticated visitors can browse and search materials but cannot download, upload, upvote, or report anything. Show a "Login to interact" nudge.

---

## Design System
- Dark mode by default with a light mode toggle (saved to localStorage)
- Color palette: deep navy (#0f172a) background, white (#ffffff) text, amber (#f59e0b) accent
- Font: Inter (from Google Fonts)
- Icon library: lucide-react (use consistently throughout)
- Sidebar navigation on desktop; bottom tab bar on mobile
- All data tables use striped rows with hover highlight
- Cards have subtle border + shadow; on hover, lift with box-shadow transition
- Loading states: skeleton loaders (not spinners)
- Empty states: centered illustration + message + action button
- Confirmation dialogs for all destructive actions
- Toast notifications (bottom-right) for success/error feedback

---

## Supabase Configuration
- Use @supabase/supabase-js v2
- Create a single supabaseClient.js using VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY env vars
- Auth: email + password via supabase.auth.signInWithPassword / signUp
- On signUp, pass username and full_name in options.data
- After login, fetch the user's profile from the `profiles` table joined with `roles` to get role name
- Store the user profile in a React context (AuthContext) accessible app-wide
- File uploads go to the `materials` Supabase Storage bucket. Store public URL in file_url.

---

## Page-by-Page Specification

### /auth/login & /auth/register
- Standard auth flow. On register, require full name, username, email, password.
- Redirect to appropriate dashboard based on role upon login.

### / (Home / Materials Browse)
- Hero section for unauthenticated: app name, tagline, Login / Register buttons
- Filter sidebar: Department, Course, Semester, Subject, Material Type, Status
- Search bar at top: filters by title + description
- Material card shows: Title, Subject, Type badge, "Verified" badge, Uploader name, Download count, Upvote button, Common Subject badge.
- Clicking a card opens the Material Detail Page.

### /materials/:id (Material Detail)
- Left column: PDF/image viewer (react-pdf or img tag). If other file type, show download button.
- Right column: Metadata panel (Title, description, Type badge, Uploaded by, Subject, Semester, Download count, Upvote button).
- Action buttons: Download, Report (students only), Edit/Delete (uploader or admin).

### /upload (Upload Material) — authenticated only
- Fields: Title, Description, Type, Department, Course, Semester, Subject, Common subject toggle.
- File upload area: drag-and-drop zone. Accept: .pdf, .png, .jpg (Max 20MB).
- Submit: Teachers/verifiers bypass approval (status='approved'). Students go to 'pending' and create a request (type='note_approval').

### /dashboard (role-aware)
- **Admin Dashboard:** Stats row, Pending Requests widget, Recent Users, Recent Activity log.
- **Teacher Dashboard:** Materials awaiting verification, My uploaded materials, Students promoted.
- **Verifier Dashboard:** Verification queue.
- **Student Dashboard:** Recently added materials, My request statuses, Quick links.

### /admin (Admin Panel) — admin only
Tabbed layout:
- **Users:** Searchable table. Change roles, Ban/Unban.
- **Departments, Courses, Subjects:** CRUD operations via tables and modals.
- **Requests:** Unified pending requests table. Approve/Reject with reasoning.
- **Reports:** Resolve or Take Action (ban/remove).
- **Audit Log:** Full timeline of actions.
- **Instance Settings:** - Form fields for Instance Name, Open Registration toggle. 
  - **Federated Peers Table:** Manage remote instances by adding Name, Supabase URL, and Anon Key to the `federated_instances` table.

### /requests — authenticated only
- Users can view their request history and submit new ones (New Course, Role Upgrade, etc.).

### /federation (The Grid) — authenticated only
- Page header: "The Global Learn Grid" explaining peer-to-peer sharing.
- **Dynamic S2S Federation Logic (CRITICAL):**
  1. Fetch all `active` peers from the local `federated_instances` table.
  2. For each peer, dynamically instantiate a new Supabase client using its `supabase_url` and `anon_key` (e.g., `createClient(peerUrl, peerKey)`).
  3. Query that remote instance's `materials` table for rows where `status = 'approved'`.
  4. Aggregate all remote materials into a single feed.
- Display a unified grid of these remote materials.
- Material Cards on this page must show an "Instance Badge" (using the name from the federated_instances table) so the user knows which college it came from.
- Remote cards should open a view-only detail modal with a Download button (pointing to the remote file_url). No editing or upvoting.

### Notifications
- Bell icon in navbar with unread count. Dropdown panel showing notifications subscribed via Supabase Realtime.

---

## Error Handling
Wrap all Supabase calls in try/catch. Show error toasts for failures. Redirect unauthorized access to /auth/login.

Build this completely. Do not leave placeholder components.

```

---

## 5. Follow-Up Prompts (use after initial generation, one at a time)

1. **PDF Preview:** "Add a PDF preview using react-pdf inside the Material Detail page. Show page navigation controls. If the file is an image, show it in an `<img>` tag with click-to-zoom."
2. **Audit Log Timeline:** "In the Admin Panel Audit Log tab, replace the table view with a vertical timeline showing the actor, action type as a color-coded pill, target, and relative timestamp."
3. **Drag-and-Drop Upload:** "Improve the Upload Material page. Replace the file input with a drag-and-drop zone using react-dropzone. Show a linear progress bar during upload."
4. **Dashboard Animations:** "Refactor all dashboards to use animated count-up stat cards."

---

## 6. Demo Script Checklist (10 Minutes)

*To properly demo Federation, create a **second** Supabase project before your demo, run the schema, add 2-3 sample materials, and grab its URL and Anon Key.*

1. **Student:** Login, browse, attempt download, upload pending material, view requests.
2. **Teacher:** Login, view pending verifications, approve student material, upload approved material.
3. **Verifier:** Login, view verification queue, approve note.
4. **Admin:** Login, view stat cards, promote a student to verifier, add department, check audit log.
5. **Federation Magic:** - In Admin Panel -> Instance Settings, add a new Peer Node (paste your second Supabase project's URL and Key).
* Navigate to `/federation`.
* Watch as the app live-queries the remote database and populates the grid with remote materials.


6. **Polish:** Toggle dark mode, show mobile layout, check notification bell.
