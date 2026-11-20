// Фінальне сортування кандидатів через Gemini: порівнює фото покупця з фото товарів «як людина».
import { fetchAsDataUri } from "./embed.ts";

export const RERANK_MODEL = "gemini-3.1-flash-lite";
export type Usage = { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; totalTokenCount?: number };

/** Повертає індекси кандидатів (0…n-1) від найсхожішого; null — якщо Gemini не відповів вчасно. */
export async function rerank(key: string, query: string, photos: (string | null)[], timeoutMs = 9000):
  Promise<{ order: number[] | null; usage?: Usage; ms: number; error?: string }> {
  const t0 = Date.now();
  try {
    const imgs = await Promise.all(photos.map((u) => u ? fetchAsDataUri(u).catch(() => null) : Promise.resolve(null)));
    const part = (d: string) => { const [h, b] = d.split(","); return { inlineData: { mimeType: h.slice(5, h.indexOf(";")), data: b } }; };
    const parts: unknown[] = [
      { text: "ЗАПИТ — фото світильника від покупця (може бути інтер'єр або скріншот):" }, part(query),
      { text: "Нижче товари каталогу, кожен з номером. Визнач, які з них — та сама або майже та сама модель світильника " +
        "(форма плафонів, каркас, кількість ламп, стиль). Колір і розмір можуть відрізнятися. " +
        'Відповідь — лише JSON {"match":[номери від найсхожішого]}, не більше 12, без схожих лише за типом.' },
    ];
    imgs.forEach((d, i) => { if (d) parts.push({ text: `#${i}` }, part(d)); });
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), Math.max(1000, timeoutMs - (Date.now() - t0)));
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${RERANK_MODEL}:generateContent`, {
      method: "POST", signal: ctl.signal,
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json", temperature: 0, maxOutputTokens: 200,
          mediaResolution: "MEDIA_RESOLUTION_LOW", thinkingConfig: { thinkingLevel: "minimal" } },
      }),
    }).finally(() => clearTimeout(tm));
    const j = await r.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[]; usageMetadata?: Usage; error?: { message: string } };
    if (!r.ok) return { order: null, ms: Date.now() - t0, error: j.error?.message ?? String(r.status) };
    const txt = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const m = (JSON.parse(txt.replace(/^```json|```$/g, "").trim()) as { match?: number[] }).match ?? [];
    const order = [...new Set(m.map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < photos.length && imgs[i]))];
    return { order, usage: j.usageMetadata, ms: Date.now() - t0 };
  } catch (e) {
    return { order: null, ms: Date.now() - t0, error: String((e as Error).message ?? e) };
  }
}
