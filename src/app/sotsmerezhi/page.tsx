import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/supabase";

import { SocialAccounts, SocialPosts, type Acc, type Post } from "@/components/Social";

export const revalidate = 3600; // оновлення даних каталогу щогодини
export const metadata: Metadata = { title: "Ми в соцмережах", description: "Svitlo Plaza в Instagram, Facebook, TikTok та інших соцмережах." };

export default async function SocialPage() {
  const [{ data: acc }, { data: posts }] = await Promise.all([
    db.from("social_accounts").select("*").order("sort"),
    db.from("social_posts").select("*").order("sort").order("published_at", { ascending: false }).limit(24),
  ]);
  return (
    <main className="wrap section">
      <div className="crumbs"><Link href="/">Головна</Link><span>/</span><span>Ми в соцмережах</span></div>
      <div className="page-head">
        <h1>Ми в <span className="mute">соцмережах</span></h1>
        <p>Новинки, інтер'єри клієнтів і світло, яке ми любимо. Підписуйтеся, щоб бачити все першими.</p>
      </div>
      <SocialAccounts items={(acc ?? []) as Acc[]} />
      {posts && posts.length > 0 && (<><h2 style={{ fontSize: 32, margin: "56px 0 20px" }}>Останні <span className="mute">публікації</span></h2><SocialPosts items={posts as Post[]} /></>)}
    </main>
  );
}
