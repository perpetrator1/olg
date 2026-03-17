import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://grwsoeujmocqbtcscdjv.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyd3NvZXVqbW9jcWJ0Y3NjZGp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2Mzc4ODgsImV4cCI6MjA4OTIxMzg4OH0.VWbAD0X5CycXNWYaZbo_ioDboSsFExYshPfKymalCoY');

async function check() {
  console.log('--- STARTING DB CHECK ---');
  try {
    const { data: mats, error: matError } = await supabase.from('materials').select('*');
    if (matError) {
        console.error('Error fetching materials:', matError);
    } else {
        console.log('Materials in table:', mats.length);
        mats.forEach(m => {
            console.log(`ID: ${m.id}, Title: ${m.title}, Status: ${m.status}`);
        });
    }

    const { data: reqs, error: reqError } = await supabase.from('requests').select('*');
    if (reqError) {
        console.error('Error fetching requests:', reqError);
    } else {
        console.log('Requests in table:', reqs.length);
        reqs.forEach(r => {
            console.log(`ID: ${r.id}, Type: ${r.type}, Status: ${r.status}, Material ID: ${r.payload?.material_id || r.details?.material_id}`);
        });
    }
  } catch (err) {
    console.error('Fatal error:', err);
  }
  console.log('--- END DB CHECK ---');
}

check();
