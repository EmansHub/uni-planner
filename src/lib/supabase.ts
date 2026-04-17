import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl) {
  throw new Error('VITE_SUPABASE_URL is required.');
}

if (!supabaseKey) {
  throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY is required.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);