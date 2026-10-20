import Link from "next/link";
export default function NotFound() {
  return (
    <main className="wrap section" style={{ minHeight: "60vh" }}>
      <div className="page-head"><h1>Сторінку <span className="mute">не знайдено</span></h1><p>Можливо, модель зняли з продажу або адреса змінилась.</p></div>
      <div className="cta"><Link className="btn btn-main" href="/katalog">До каталогу</Link><Link className="btn btn-sec" href="/">На головну</Link></div>
    </main>
  );
}
