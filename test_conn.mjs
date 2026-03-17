import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

const supabase = createClient(url, key);

async function check() {
  console.log('Testing connection...');
  const { data, error } = await supabase.from('roles').select('name').limit(1);
  if (error) {
    console.error('Connection failed:', error.message);
  } else {
    console.log('Connection successful, roles found:', data);
  }
  process.exit(0);
}

check();
