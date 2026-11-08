"""Автогенерація ШІ-інтер'єрів (Gemini API через Edge-функцію ai-gen) і публікація схвалених.

  AI_SECRET=… python3 scripts/ai_batch.py queue 20 [L,P]          показати чергу (найдорожчі в наявності)
  AI_SECRET=… python3 scripts/ai_batch.py gen 50 [L,P] [--model gemini-3-pro-image-preview] [--par 4]
  AI_SECRET=… python3 scripts/ai_batch.py gen-codes SP-L134,SP-L346 [--model …]
  AI_SECRET=… python3 scripts/ai_batch.py publish                  схвалені → webp → галерея (ai-photos), статус published

Затвердження — https://www.svitloplaza.store/ai-pereglyad#k=СЕКРЕТ. Відхилені моделі самі повертаються в чергу.
"""
import io, json, sys, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from ai_photos import call as put_photo  # noqa: E402

GEN = "https://teidqxvftoihhwmubiyf.supabase.co/functions/v1/ai-gen"
import os
SECRET = os.environ["AI_SECRET"]


def req(action, method="GET", body=None, **params):
    qs = "&".join(f"{k}={v}" for k, v in {"action": action, **params}.items() if v is not None)
    r = urllib.request.Request(f"{GEN}?{qs}", method=method, data=json.dumps(body).encode() if body else None,
                               headers={"x-ai-secret": SECRET, "content-type": "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=300) as x:
            return json.load(x)
    except urllib.error.HTTPError as e:
        return {"error": f"{e.code} {e.read()[:300].decode(errors='ignore')}"}


def opt(a, name, default=None):
    return a[a.index(name) + 1] if name in a else default


def gen(codes, model, par):
    ok = bad = 0
    def one(c):
        return c, req("gen", "POST", code=c, model=model)
    with ThreadPoolExecutor(par) as ex:
        for c, r in ex.map(one, codes):
            if "error" in r: bad += 1; print(f"✗ {c}: {r['error']}")
            else: ok += 1; print(f"✓ {c} #{r['id']}")
    print(f"готово: {ok} кадрів, помилок {bad}")


def publish():
    rows = req("list", status="approved")
    for c in rows:
        code = c["model_code"]
        have = put_photo("GET", code)["photos_ai"]
        n = len(have) + 1
        if n > 9: print(f"{code}: уже 9 кадрів, пропуск"); continue
        raw = urllib.request.urlopen(c["url"], timeout=120).read()
        im = Image.open(io.BytesIO(raw)).convert("RGB"); im.thumbnail((2000, 2000), Image.LANCZOS)
        b = io.BytesIO(); im.save(b, "WEBP", quality=82, method=6)
        put_photo("PUT", code, n, b.getvalue())
        req("decide", "POST", {"id": c["id"], "status": "published"})
        print(f"{code} #{n}: на сайті → https://www.svitloplaza.store/p/{code.lower()}")
    print(f"опубліковано: {len(rows)}")


def main(a):
    model, par = opt(a, "--model", "gemini-3-pro-image-preview"), int(opt(a, "--par", "4"))
    if a[0] == "queue":
        for r in req("queue", limit=a[1] if len(a) > 1 else 20, kinds=a[2] if len(a) > 2 and not a[2].startswith("--") else None):
            print(r["code"], r["kind_code"], r["price"])
    elif a[0] == "gen":
        q = req("queue", limit=a[1], kinds=a[2] if len(a) > 2 and not a[2].startswith("--") else None)
        gen([r["code"] for r in q], model, par)
    elif a[0] == "gen-codes":
        gen(a[1].split(","), model, par)
    elif a[0] == "publish":
        publish()


if __name__ == "__main__":
    main(sys.argv[1:])
