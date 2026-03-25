import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testFetch() {
  // First, get one material ID
  const { data: materials, error: mError } = await supabase.from('materials').select('id').limit(1);
  if (mError) {
    console.error('Error fetching materials list:', mError);
    return;
  }
  if (!materials || materials.length === 0) {
    console.log('No materials found in table.');
    return;
  }

  const id = materials[0].id;
  console.log('Testing with Material ID:', id);

  const { data, error } = await supabase
    .from('materials')
    .select(`
      *,
      profiles(full_name, username)
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.log('QUERY ERROR:', error);
  } else {
    console.log('SUCCESS:', data);
  }
}

testFetch();
