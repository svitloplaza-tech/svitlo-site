import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Inter_Tight, Doto } from "next/font/google";
import localFont from "next/font/local";
import Header from "@/components/Header";
import Ambient from "@/components/Ambient";
import "./globals.css";
import { LOGO } from "@/lib/brand";

const inter = Inter_Tight({ subsets: ["latin", "cyrillic"], weight: ["300", "400", "500"], variable: "--font-inter-tight", display: "swap" });
// Цифри: Svitlo Pixel — квадратні пікселі 5×7 (табло F1), шрифт бренду. Doto лишається запасним.
// Відкат на Doto: у globals.css в --f-dot прибрати var(--font-svitlo-pixel).
const doto = Doto({ subsets: ["latin"], weight: ["600", "800"], variable: "--font-doto", display: "swap" });
const pixel = localFont({ src: "./fonts/SvitloPixel-Regular.woff2", weight: "100 900", variable: "--font-svitlo-pixel", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://www.svitloplaza.store"),
  title: { default: "Svitlo Plaza — світильники для дому й бізнесу", template: "%s · Svitlo Plaza" },
  description: "Люстри, підвісні світильники, бра, торшери й вуличне світло. Шоурум, доставка Новою Поштою по Україні.",
};
export const viewport: Viewport = { themeColor: "#000000", viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className={`${inter.variable} ${doto.variable} ${pixel.variable}`}>
      <body>
        <Ambient />
        <Header />
        {children}
        <footer className="site"><div className="wrap">
          <div><Link className="logo" href="/" aria-label="Svitlo Plaza — на головну"><img src={LOGO} alt="Svitlo Plaza" /></Link><p style={{ maxWidth: "36ch" }}>Світильники для дому й бізнесу. Шоурум, доставка по Україні.</p></div>
          <div><h4>Каталог</h4><Link href="/katalog/lyustry">Люстри</Link><Link href="/katalog/pidvisni">Підвісні</Link><Link href="/katalog/bra">Бра</Link><Link href="/katalog">Усі типи</Link></div>
          <div><h4>Шоурум</h4><Link href="/shourum">Адреса й контакти</Link><Link href="/3d-tur">3D-тур</Link></div>
          <div><h4>Ми</h4><Link href="/sotsmerezhi">Ми в соцмережах</Link><Link href="/koshyk">Кошик</Link></div>
        </div></footer>
      </body>
    </html>
  );
}
