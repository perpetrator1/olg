import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testJoin() {
  const { data: materials } = await supabase.from('materials').select('id').limit(1);
  if (!materials || materials.length === 0) return console.log('No materials');

  const id = materials[0].id;
  
  // Attempt with explicit column join
  const { data, error } = await supabase
    .from('materials')
    .select(`
      *,
      profiles:uploaded_by(full_name, username)
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.log('JOIN ERROR:', error);
  } else {
    console.log('SUCCESS:', data);
  }
}

testJoin();
