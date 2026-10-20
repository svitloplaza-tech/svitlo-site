"use client";
// Розшифровка 3D-моделі (див. scripts/encode_model.py). Файл моделі на сервері зашифрований — вимога ліцензії 3D-baza.
const KEY = new TextEncoder().encode("svitlo-plaza/sp-p1228/2026");

export async function loadModel(url: string): Promise<ArrayBuffer> {
  const enc = new Uint8Array(await (await fetch(url)).arrayBuffer());
  const out = new Uint8Array(enc.length);
  const buf = new Uint8Array(KEY.length + 8);
  buf.set(KEY);
  const view = new DataView(buf.buffer);
  const jobs: Promise<void>[] = [];
  for (let i = 0; i < enc.length; i += 32) {
    const b = buf.slice(); new DataView(b.buffer).setBigUint64(KEY.length, BigInt(i), true);
    jobs.push(crypto.subtle.digest("SHA-256", b).then((h) => {
      const k = new Uint8Array(h);
      for (let j = 0; j < 32 && i + j < enc.length; j++) out[i + j] = enc[i + j] ^ k[j];
    }));
  }
  void view;
  await Promise.all(jobs);
  return out.buffer;
}
