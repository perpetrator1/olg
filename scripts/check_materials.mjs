import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkMaterials() {
  const { data, error } = await supabase
    .from('materials')
    .select('*');
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Materials in DB:', data.length);
  data.forEach(m => {
    console.log(`ID: ${m.id}, Title: ${m.title}, Status: ${m.status}, File: ${m.file_url}`);
  });
}

checkMaterials();
