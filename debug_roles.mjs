import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

const supabase = createClient(url, key);

async function debug() {
  console.log('--- ROLES ---');
  const { data: roles } = await supabase.from('roles').select('*');
  console.table(roles);

  console.log('\n--- PROFILES (First 5) ---');
  const { data: profiles } = await supabase.from('profiles').select('id, username, role_id, roles(name)').limit(5);
  console.table(profiles?.map(p => ({
    id: p.id,
    username: p.username,
    role_id: p.role_id,
    role_name: p.roles?.name
  })));

  process.exit(0);
}

debug();
