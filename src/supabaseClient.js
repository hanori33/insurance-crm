import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ajuxgluckhourworlwmt.supabase.co";
const supabaseKey = "sb_publishable_s_toIdqTWq8t5iIDFaQdWw_3W4ZyeD_";

export const supabase = createClient(supabaseUrl, supabaseKey);
