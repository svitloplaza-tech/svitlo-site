// Перевикористовувані блоки соцмереж (сторінка «Ми в соцмережах», пізніше — головна).
// Пости: source='auto' — щонічна Edge-функція social-sync (YouTube, Telegram, Instagram, Facebook); 'manual' — добірка вручну (sort < 1000 → першими).
const NET: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", youtube: "YouTube", telegram: "Telegram", pinterest: "Pinterest", threads: "Threads" };
const CTA: Record<string, string> = { youtube: "Дивитися канал", telegram: "Приєднатися", facebook: "Перейти на сторінку" };
const FOL: Record<string, string> = { youtube: "підписників", telegram: "учасників" };
export type Acc = { id: number; network: string; handle: string | null; url: string; followers: number | null };
export type Post = { id: number; network: string; url: string; image: string | null; caption: string | null; published_at: string | null; media?: string };

const short = (n: number) => (n >= 1e4 ? `${(n / 1e3).toLocaleString("uk-UA", { maximumFractionDigits: 1 })} тис.` : n.toLocaleString("uk-UA"));
const date = (s: string | null) => (s ? new Date(s).toLocaleDateString("uk-UA", { day: "numeric", month: "long" }) : "");

/** Блоки SocialAccounts і SocialPosts — перевикористовувані: пізніше їх можна поставити на головну. */
export function SocialAccounts({ items }: { items: Acc[] }) {
  if (!items.length) return <div className="empty-note">Посилання на сторінки додамо найближчим часом.</div>;
  return (
    <div className="socgrid">
      {items.map((a) => (
        <a key={a.id} className={`soc soc-${a.network}`} href={a.url} target="_blank" rel="noopener noreferrer">
          <b>{(NET[a.network] ?? a.network).toUpperCase()}</b>
          <span>{a.handle ?? NET[a.network] ?? a.network}</span>
          {a.followers ? <small className="mute">{short(a.followers)} {FOL[a.network] ?? "підписників"}</small> : null}
          <em>{CTA[a.network] ?? "Підписатися"} →</em>
        </a>
      ))}
    </div>
  );
}
export function SocialPosts({ items }: { items: Post[] }) {
  if (!items.length) return null;
  return (
    <div className="posts">
      {items.map((p) => (
        <a key={p.id} className="post" href={p.url} target="_blank" rel="noopener noreferrer">
          <div className={`ph${p.image ? "" : " ph-text"}`}>
            {p.image ? <img src={p.image} alt={p.caption?.slice(0, 120) ?? ""} loading="lazy" decoding="async" /> : <p>{p.caption}</p>}
            {p.media === "video" && <i className="play" aria-label="Відео" />}
            <span className="net">{NET[p.network] ?? p.network}</span>
          </div>
          {p.published_at && <small className="mute">{date(p.published_at)}</small>}
          {p.image && p.caption && <p>{p.caption}</p>}
        </a>
      ))}
    </div>
  );
}
