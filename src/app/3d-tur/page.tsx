import Link from "next/link";
import type { Metadata } from "next";
import { getSetting } from "@/lib/catalog";

export const revalidate = 3600; // оновлення даних каталогу щогодини
export const metadata: Metadata = { title: "3D-тур шоурумом", description: "Віртуальна прогулянка шоурумом Svitlo Plaza у Matterport." };

type Tour = { enabled: boolean; model_id: string | null; note?: string };

/**
 * Matterport: у адмінці (таблиця site_settings, ключ "matterport") вказуємо model_id
 * з посилання my.matterport.com/show/?m=XXXX і вмикаємо enabled — тур з'являється тут.
 */
export default async function TourPage() {
  const t = await getSetting<Tour>("matterport");
  const on = !!(t?.enabled && t.model_id && /^[A-Za-z0-9]+$/.test(t.model_id));
  return (
    <main className="wrap section">
      <div className="crumbs"><Link href="/">Головна</Link><span>/</span><span>3D-тур</span></div>
      <div className="page-head">
        <span className="chip"><b>3D</b><span>Шоурум онлайн</span></span>
        <h1>Прогуляйтеся <span className="mute">шоурумом</span></h1>
        <p>Подивіться світильники наживо в інтер'єрі, не виходячи з дому. Обертайте камеру й переходьте між зонами.</p>
      </div>
      {on ? (
        <div className="panel tour">
          <iframe src={`https://my.matterport.com/show/?m=${t!.model_id}&play=1&brand=0&lang=uk`} title="3D-тур шоурумом Svitlo Plaza"
            allow="fullscreen; xr-spatial-tracking" allowFullScreen loading="lazy" />
        </div>
      ) : (
        <div className="panel tour-empty">
          <div>
            <h2>Тур оновлюється</h2>
            <p>{t?.note ?? "Тур оновлюється після реновації шоуруму"}. Поки що запишіться на візит, і ми покажемо все наживо.</p>
            <div className="cta" style={{ justifyContent: "center" }}>
              <Link className="btn btn-main" href="/shourum">Записатися на візит</Link>
              <Link className="btn btn-sec" href="/katalog">Відкрити каталог</Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
