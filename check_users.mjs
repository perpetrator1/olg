import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

const supabase = createClient(url, key);

async function check() {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select(`
      id,
      username,
      roles (
        name
      )
    `);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('--- USERS AND ROLES ---');
    profiles.forEach(p => {
      console.log(`User: ${p.username}, Role: ${p.roles?.name || 'NULL'}, ID: ${p.id}`);
    });
  }
  process.exit(0);
}

check();
