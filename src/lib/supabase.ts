import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

/** Клієнт лише для читання каталогу (RLS дозволяє тільки SELECT). */
export const db = createClient(url, key, { auth: { persistSession: false } });
