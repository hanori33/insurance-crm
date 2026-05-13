import { createClient } from '@supabase/supabase-js';

const URL = process.env.REACT_APP_SUPABASE_URL || '';
const KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

if (!URL || !KEY) {
  console.warn('[BoPlan] .env에 SUPABASE_URL / SUPABASE_ANON_KEY 를 설정해주세요.');
}

export const supabase = createClient(URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});