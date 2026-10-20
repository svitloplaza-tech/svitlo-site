import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Inter_Tight, Doto } from "next/font/google";
import Header from "@/components/Header";
import Ambient from "@/components/Ambient";
import "./globals.css";

const inter = Inter_Tight({ subsets: ["latin", "cyrillic"], weight: ["300", "400", "500"], variable: "--font-inter-tight", display: "swap" });
// Svitlo Dot (власний шрифт бренду) підключимо файлом, коли він буде в репозиторії; поки — Doto.
const doto = Doto({ subsets: ["latin"], weight: ["600", "800"], variable: "--font-doto", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://www.svitloplaza.store"),
  title: { default: "Svitlo Plaza — світильники для дому й бізнесу", template: "%s · Svitlo Plaza" },
  description: "Люстри, підвісні світильники, бра, торшери й вуличне світло. Шоурум, доставка Новою Поштою по Україні.",
};
export const viewport: Viewport = { themeColor: "#000000", viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className={`${inter.variable} ${doto.variable}`}>
      <body>
        <Ambient />
        <Header />
        {children}
        <footer className="site"><div className="wrap">
          <div><Link className="logo" href="/">Svitlo <i>●</i> Plaza</Link><p style={{ maxWidth: "36ch" }}>Світильники для дому й бізнесу. Шоурум, доставка по Україні.</p></div>
          <div><h4>Каталог</h4><Link href="/katalog/lyustry">Люстри</Link><Link href="/katalog/pidvisni">Підвісні</Link><Link href="/katalog/bra">Бра</Link><Link href="/katalog">Усі типи</Link></div>
          <div><h4>Шоурум</h4><Link href="/shourum">Адреса й контакти</Link><Link href="/3d-tur">3D-тур</Link></div>
          <div><h4>Ми</h4><Link href="/sotsmerezhi">Ми в соцмережах</Link><Link href="/koshyk">Кошик</Link></div>
        </div></footer>
      </body>
    </html>
  );
}
