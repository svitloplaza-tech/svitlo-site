// Спільне для photo-index і photo-search: відбиток картинки через Cloudflare Workers AI.
export const MODEL = "@cf/google/embeddinggemma-2";

/** Кілька картинок (data:URI) → вектори 768 (по одному на картинку, у тому ж порядку). */
export async function embedImages(account: string, token: string, dataUris: string[]): Promise<number[][]> {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${MODEL}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      messages: dataUris.map((u) => [{ role: "user", content: [{ type: "image_url", image_url: { url: u } }] }]),
    }),
  });
  const j = await r.json().catch(() => ({})) as Record<string, unknown>;
  if (!r.ok) throw new Error(`AI ${r.status}: ${JSON.stringify(j).slice(0, 250)}`);
  const res = (j.result ?? j) as { data?: { embedding: number[]; index?: number }[] };
  const data = res.data ?? [];
  const out: number[][] = [];
  data.forEach((d, i) => { out[d.index ?? i] = d.embedding; });
  if (out.length !== dataUris.length) throw new Error(`AI повернув ${out.length} з ${dataUris.length}`);
  return out;
}

/** Завантажити фото каталогу як data:URI (для LineF — середній розмір замість оригіналу). */
export async function fetchAsDataUri(url: string): Promise<string> {
  const u = url.includes("linef.com.ua/uploads/products/original/") ? url.replace("/original/", "/middle/") : url;
  const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 (compatible; SvitloPlazaBot/1.0)" } });
  if (!r.ok) throw new Error(`фото ${r.status}`);
  const type = (r.headers.get("content-type") ?? "image/jpeg").split(";")[0];
  if (!type.startsWith("image/")) throw new Error(`не картинка: ${type}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf.length > 4_000_000) throw new Error(`завелике фото ${buf.length}`);
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(s)}`;
}
