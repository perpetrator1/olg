import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1];
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1];

if (!url || !key) {
  console.error('Could not find Supabase URL or Key in .env');
  process.exit(1);
}

const supabase = createClient(url.trim(), key.trim());

async function check() {
  console.log('Checking materials and roles...');
  
  const { data: materials, error: mErr } = await supabase.from('materials').select('id, title, status, uploaded_by');
  if (mErr) console.error('Error fetching materials:', mErr);
  else console.log('Materials:', JSON.stringify(materials, null, 2));

  const { data: roles, error: rErr } = await supabase.from('roles').select('*');
  if (rErr) console.error('Error fetching roles:', rErr);
  else console.log('Roles:', JSON.stringify(roles, null, 2));

  const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, username, role_id, roles(name)');
  if (pErr) console.error('Error fetching profiles:', pErr);
  else console.log('Profiles:', JSON.stringify(profiles, null, 2));
  
  process.exit(0);
}

check();
