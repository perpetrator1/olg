import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://grwsoeujmocqbtcscdjv.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyd3NvZXVqbW9jcWJ0Y3NjZGp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2Mzc4ODgsImV4cCI6MjA4OTIxMzg4OH0.VWbAD0X5CycXNWYaZbo_ioDboSsFExYshPfKymalCoY');
async function check() {
  let { data: reqs } = await supabase.from('requests').select('*');
  console.log('Requests:', JSON.stringify(reqs, null, 2));
  let { data: mats } = await supabase.from('materials').select('*');
  console.log('Materials:', JSON.stringify(mats, null, 2));
}
check();
