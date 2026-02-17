import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !serviceKey) {
  throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定");
}

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false },
});