import type { Metadata } from "next";
import Link from "next/link";
import FavList from "@/components/FavList";

export const metadata: Metadata = { title: "Обране", robots: { index: false } };
export default function FavPage() {
  return (
    <main className="wrap section">
      <div className="crumbs"><Link href="/">Головна</Link><span>/</span><span>Обране</span></div>
      <div className="page-head"><h1>Обране <span className="mute">світильники, які сподобались</span></h1></div>
      <FavList />
    </main>
  );
}
