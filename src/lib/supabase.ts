import { createClient } from "@supabase/supabase-js";

// Публічні значення (безпечні для браузера). Запасні значення потрібні для збірки на Cloudflare,
// де змінні з wrangler.jsonc доступні лише під час роботи сайту, а не під час `next build`.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://teidqxvftoihhwmubiyf.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_Sm2y9bo0N-Zx-FfnfUWAqg_k9CidQkt";

/** Клієнт лише для читання каталогу (RLS дозволяє тільки SELECT). */
export const db = createClient(url, key, { auth: { persistSession: false } });
