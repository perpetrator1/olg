import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

const supabase = createClient(url, key);

async function check() {
  console.log('Fetching all profiles and their roles...');
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select(`
      id,
      username,
      full_name,
      email,
      role_id,
      roles (
        name
      )
    `);

  if (pErr) {
    console.error('Error fetching profiles:', pErr);
  } else {
    console.log('Profiles Found:');
    profiles.forEach(p => {
      console.log(`- ${p.username} (${p.email}): role=${p.roles?.name || 'NULL'}, id=${p.id}`);
    });
  }

  const { data: roles } = await supabase.from('roles').select('*');
  console.log('\nRoles Table:');
  console.log(roles);

  const { data: materials } = await supabase.from('materials').select('id, title, uploaded_by, status');
  console.log('\nMaterials:');
  console.log(materials);

  process.exit(0);
}

check();
