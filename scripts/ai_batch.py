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


GKEY = True  # генеруємо тут: референс стискаємо, Gemini — через ai-gen?action=proxy (ключ лишається в Supabase)


import random
STYLES = ["Scandinavian", "warm minimalist", "Japandi", "modern classic with wall moldings", "contemporary with natural stone accents",
          "soft modern with a curved sofa", "mid-century modern", "quiet luxury with travertine and walnut"]
PLANTS = ["an olive tree in a terracotta pot", "a tall monstera", "a bird of paradise plant", "dried pampas grass in a floor vase",
          "a small potted palm", "branches of eucalyptus in a glass vase", "a snake plant in a concrete planter"]
WALLS = ["warm white", "greige", "soft sand", "light taupe", "pale sage green", "limewash beige"]


def variation(code):
    r = random.Random(f"{code}-{random.random()}")  # різні кадри для різних моделей і спроб
    return (f"Interior style: {r.choice(STYLES)}, {r.choice(WALLS)} walls; use {r.choice(PLANTS)} instead of a fiddle-leaf fig. "
            "Scale check: the lamp must look clearly smaller than the sofa or the table beneath it, with plenty of empty ceiling around it.")


def gen_local(code, model):
    import base64, urllib.parse
    p = req("prompt", code=code)
    if "error" in p: return p
    p["prompt"] += " " + variation(code)
    raw = urllib.request.urlopen(urllib.request.Request(p["photo"], headers={"user-agent": "Mozilla/5.0 SvitloPlaza"}), timeout=60).read()
    ref = Image.open(io.BytesIO(raw)).convert("RGB"); ref.thumbnail((1600, 1600), Image.LANCZOS)
    rb = io.BytesIO(); ref.save(rb, "JPEG", quality=90)
    body = {"contents": [{"role": "user", "parts": [{"inline_data": {"mime_type": "image/jpeg", "data": base64.b64encode(rb.getvalue()).decode()}}, {"text": p["prompt"]}]}],
            "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": "4:5", "imageSize": "2K"}}}
    r = urllib.request.Request(f"{GEN}?action=proxy&model={model}", data=json.dumps(body).encode(),
                               headers={"x-ai-secret": SECRET, "content-type": "application/json"}, method="POST")
    try:
        d = json.load(urllib.request.urlopen(r, timeout=300))
    except urllib.error.HTTPError as e:
        return {"error": f"gemini {e.code} {e.read()[:200].decode(errors='ignore')}"}
    parts = (d.get("candidates") or [{}])[0].get("content", {}).get("parts", [])
    img = next((x["inlineData"]["data"] for x in parts if "inlineData" in x), None)
    if not img: return {"error": f"no image {(d.get('candidates') or [{}])[0].get('finishReason')} {d.get('promptFeedback')}"}
    out = Image.open(io.BytesIO(base64.b64decode(img))).convert("RGB")
    ob = io.BytesIO(); out.save(ob, "WEBP", quality=84, method=6)
    up = urllib.request.Request(f"{GEN}?action=add&code={code}&model={model}", data=ob.getvalue(), method="PUT",
                                headers={"x-ai-secret": SECRET, "content-type": "image/webp", "x-prompt": urllib.parse.quote(p["prompt"])})
    try:
        return json.load(urllib.request.urlopen(up, timeout=120))
    except urllib.error.HTTPError as e:
        return {"error": f"add {e.code} {e.read()[:200].decode(errors='ignore')}"}


def gen(codes, model, par):
    ok = bad = 0
    def one(c):
        try:
            return c, (gen_local(c, model) if GKEY else req("gen", "POST", code=c, model=model))
        except Exception as e:  # мережа тощо
            return c, {"error": repr(e)[:200]}
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
    model, par = opt(a, "--model", "gemini-3.1-flash-image"), int(opt(a, "--par", "4"))
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
