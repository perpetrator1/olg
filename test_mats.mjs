import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

const supabase = createClient(url, key);

async function check() {
  console.log('Querying materials...');
  const { data, error } = await supabase.from('materials').select('id, title, status').limit(5);
  if (error) console.error(error);
  else console.log(data);
  process.exit(0);
}

check();
