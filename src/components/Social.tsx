// Перевикористовувані блоки соцмереж (сторінка «Ми в соцмережах», пізніше — головна).
// Пости: source='auto' — щонічна Edge-функція social-sync (YouTube, Telegram, Instagram, Facebook); 'manual' — добірка вручну (sort < 1000 → першими).
const NET: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", youtube: "YouTube", telegram: "Telegram", pinterest: "Pinterest", threads: "Threads" };
const CTA: Record<string, string> = { youtube: "Підписатися на канал", telegram: "Приєднатися", facebook: "Стежити" };
const FOL: Record<string, string> = { youtube: "підписників", telegram: "учасників" };
export type Acc = { id: number; network: string; handle: string | null; url: string | null; followers: number | null; bg?: string[] | null };
export type Post = { id: number; network: string; url: string; image: string | null; caption: string | null; published_at: string | null; media?: string };

const short = (n: number) => (n >= 1e4 ? `${(n / 1e3).toLocaleString("uk-UA", { maximumFractionDigits: 1 })} тис.` : n.toLocaleString("uk-UA"));
const date = (s: string | null) => (s ? new Date(s).toLocaleDateString("uk-UA", { day: "numeric", month: "long" }) : "");
/** Підписка в один дотик: YouTube відкриває вікно «Підписатися», решта — профіль у застосунку (на телефоні). */
const subUrl = (a: Acc) => (a.network === "youtube" && a.url ? `${a.url.replace(/\/$/, "")}?sub_confirmation=1` : a.url);

/** Блоки SocialAccounts і SocialPosts — перевикористовувані: пізніше їх можна поставити на головну.
 *  Картка: розмита добірка фото з цієї мережі (social_accounts.bg) + велика назва мережі під кутом у її кольорі. */
export function SocialAccounts({ items }: { items: Acc[] }) {
  if (!items.length) return <div className="empty-note">Посилання на сторінки додамо найближчим часом.</div>;
  return (
    <div className="socgrid">
      {items.map((a) => {
        const name = NET[a.network] ?? a.network;
        const inner = (
          <>
            {a.bg?.length ? <div className="soc-bg" aria-hidden>{a.bg.slice(0, 3).map((u) => <img key={u} src={u} alt="" loading="lazy" decoding="async" />)}</div> : null}
            <i className="soc-mark" aria-hidden>{name}</i>
            <div className="soc-body">
              <b>{name.toUpperCase()}</b>
              <span>{a.url ? a.handle ?? name : "Канал готується"}</span>
              {a.followers ? <small>{short(a.followers)} {FOL[a.network] ?? "підписників"}</small> : null}
              <em className="soc-btn">{a.url ? `${CTA[a.network] ?? "Підписатися"} →` : "Незабаром"}</em>
            </div>
          </>
        );
        return a.url
          ? <a key={a.id} className={`soc soc-${a.network}`} href={subUrl(a)!} target="_blank" rel="noopener noreferrer">{inner}</a>
          : <div key={a.id} className={`soc soc-${a.network} soc-soon`}>{inner}</div>;
      })}
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
