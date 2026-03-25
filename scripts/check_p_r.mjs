import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

const supabase = createClient(url, key);

async function check() {
  const { data: p } = await supabase.from('profiles').select('id, username, role_id');
  console.log('Profiles:', p);
  const { data: r } = await supabase.from('roles').select('id, name');
  console.log('Roles:', r);
  process.exit(0);
}

check();
