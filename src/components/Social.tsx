// Перевикористовувані блоки соцмереж (сторінка «Ми в соцмережах», пізніше — головна).
const NET: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", youtube: "YouTube", telegram: "Telegram", pinterest: "Pinterest", threads: "Threads" };
export type Acc = { id: number; network: string; handle: string | null; url: string; followers: number | null };
export type Post = { id: number; network: string; url: string; image: string | null; caption: string | null };

/** Блоки SocialAccounts і SocialPosts — перевикористовувані: пізніше їх можна поставити на головну. */
export function SocialAccounts({ items }: { items: Acc[] }) {
  if (!items.length) return <div className="empty-note">Посилання на сторінки додамо найближчим часом.</div>;
  return (
    <div className="socgrid">
      {items.map((a) => (
        <a key={a.id} className="soc" href={a.url} target="_blank" rel="noopener noreferrer">
          <b>{(NET[a.network] ?? a.network).toUpperCase()}</b><span>{a.handle ?? NET[a.network] ?? a.network}</span>
          {a.followers ? <small className="mute">{a.followers.toLocaleString("uk-UA")} підписників</small> : null}
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
          <div className="ph">{p.image && <img src={p.image} alt={p.caption ?? ""} loading="lazy" />}</div>
          {p.caption && <p>{p.caption}</p>}
        </a>
      ))}
    </div>
  );
}

