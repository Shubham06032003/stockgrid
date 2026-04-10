import { supabase } from './src/config/supabase.js';

async function listCols() {
  const { data, error } = await supabase.from('products').select('*').limit(1);
  if (error) console.error(error);
  else console.log('COLUMNS:', Object.keys(data[0] || {}).join(', '));
}
listCols();
