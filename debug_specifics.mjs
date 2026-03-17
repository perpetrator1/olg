import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

const supabase = createClient(url, key);

async function check() {
  const ids = [
    '47aeaa65-a3e9-4ea7-9695-aaa51fa44584',
    '5d40b266-2bca-46c0-aee9-e904d0b09037'
  ];

  console.log('Checking specific materials...');
  const { data: materials, error: mErr } = await supabase.from('materials').select('*').in('id', ids);
  if (mErr) console.error('Error:', mErr);
  else console.log('Materials found:', JSON.stringify(materials, null, 2));

  console.log('\nChecking all roles:');
  const { data: roles } = await supabase.from('roles').select('*');
  console.log('Roles:', roles);

  console.log('\nChecking profiles of admins/teachers/verifiers:');
  const { data: profiles } = await supabase.from('profiles').select('id, username, role_id, roles(name)');
  console.log('Profiles:', JSON.stringify(profiles, null, 2));

  process.exit(0);
}

check();
