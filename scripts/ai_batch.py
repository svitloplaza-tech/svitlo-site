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
from ai_xmp import save_webp  # noqa: E402  позначка ШІ в кожному файлі

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


SIZE = "2K"  # --size 1K дешевше (тест 11.11)
GKEY = True  # генеруємо тут: референс стискаємо, Gemini — через ai-gen?action=proxy (ключ лишається в Supabase)


import random, re
# Сцени за референсами власника (08.11, Pinterest): описуємо стиль текстом, чужі фото в модель НЕ передаємо.
OPEN_LIVING = ("Open-plan living room with a kitchen behind: greige handleless cabinets with warm LED strips under the wall cabinets and inside glass-front units, "
               "marble backsplash, an island with two upholstered bar stools; herringbone light oak floor, a light curved modular sofa with a knitted throw, "
               "a round dark wood coffee table with candles in glass lanterns and pampas grass, a soft shaggy rug, recessed downlights in the ceiling")
LOFT_LIVING = ("Dark modern loft living room: charcoal grey modular corner sofa with patterned cushions and a plaid throw, black metal-frame coffee table "
               "with stacked books and a small tray, grey textured rug, dark wood and black kitchen with a long island in the background, "
               "brick-tile accent wall, black ceiling track spotlights, tall window with a balcony railing; camera slightly elevated looking down")
JAPANDI_LIVING = ("Japandi living room: limewash plaster walls, hidden warm LED cove lighting along the ceiling, low oak furniture, linen sofa, "
                  "rattan pouf, a bonsai and ceramic vases, wooden slat wall panel, jute rug, candles on a wooden tray")
CLASSIC_LIVING = ("Parisian-style living room: white walls with classic moldings, herringbone parquet, white marble fireplace with a gilded mirror above, "
                  "velvet sofa in sage or terracotta, brass side tables, fresh flowers, art books")
BEDROOM = ("Calm Japandi-boho bedroom: warm beige plaster wall with hidden LED cove lighting, framed misty mountain print above a low wooden platform bed "
           "with rumpled linen bedding and a fringed knitted throw, wooden slat panel and a dark glass wardrobe on the side, sheer curtains, "
           "olive branches and pampas in ceramic vases, a woven basket, a jute rug, a rattan pouf, candles on a round wooden tray")
INDUSTRIAL_DINING = ("Industrial loft dining room: grey concrete-effect wall panels, black-framed glass doors to the living room, a solid wood dining table "
                     "with black X-shaped steel legs, cognac leather chairs on one side and grey upholstered chairs on the other, a large black wall clock, "
                     "black floating shelves with small plants, a black vertical radiator, a black sideboard with a small desk lamp switched off, "
                     "a distressed grey-black rug, pampas grass in a black vase on a tray")
WARM_DINING = ("Warm open-plan kitchen-dining: oak dining table with linen runner, upholstered chairs, greige kitchen with marble backsplash and LED strips "
               "behind, herringbone floor, ceramic tableware, dried flowers")
SCANDI_DINING = "Scandinavian dining room: light oak table and wishbone chairs, white walls with framed prints, linen curtains, a sideboard with ceramics, a wool rug"
KITCHEN = ("Modern greige kitchen with an island: handleless cabinets, illuminated glass-front cabinets, marble backsplash with warm LED strips, built-in oven, "
           "island with a dark stone top and two upholstered bar stools, pampas grass in a ceramic vase on the counter, herringbone oak floor")
DARK_KITCHEN = ("Dark contemporary kitchen: black and walnut cabinets, concrete countertop island with black metal bar stools, open shelves with jars and plants, "
                "warm under-cabinet LED strips")
HALLWAY = "Elegant hallway with a large round mirror, a slim oak console with ceramics and dried flowers, limewash walls, a runner rug"

SCENES = {
    "L": [f"{OPEN_LIVING}. The chandelier hangs above the coffee table", f"{LOFT_LIVING}. The chandelier hangs above the coffee table",
          f"{JAPANDI_LIVING}. The chandelier hangs in the center of the room", f"{CLASSIC_LIVING}. The chandelier hangs in the center of the room",
          f"{BEDROOM}. The chandelier hangs from the ceiling in the center of the bedroom, above the foot of the bed"],
    "L_long": [f"{INDUSTRIAL_DINING}. The chandelier hangs about 80 cm above the dining table, its long side parallel to the table",
               f"{WARM_DINING}. The chandelier hangs about 80 cm above the dining table, its long side parallel to the table",
               f"{SCANDI_DINING}. The chandelier hangs about 80 cm above the dining table, its long side parallel to the table"],
    "P_long": [f"{INDUSTRIAL_DINING}. The linear pendant hangs about 75 cm above the dining table, parallel to it",
               f"{WARM_DINING}. The linear pendant hangs about 75 cm above the dining table, parallel to it",
               f"{KITCHEN}. The linear pendant hangs about 75 cm above the island, parallel to it"],
    "P_small": [f"{KITCHEN}. Three identical pendants hang in a row above the island", f"{DARK_KITCHEN}. Three identical pendants hang in a row above the island",
                f"{INDUSTRIAL_DINING}. Three identical pendants hang in a row above the dining table",
                f"{BEDROOM}. One pendant hangs low beside the bed above the bedside table"],
    "P": [f"{WARM_DINING}. The pendant hangs about 75 cm above the table", f"{INDUSTRIAL_DINING}. The pendant hangs about 75 cm above the table",
          f"{OPEN_LIVING}. The pendant hangs above the coffee table", f"{JAPANDI_LIVING}. The pendant hangs above a low dining table"],
    "W": [f"{BEDROOM}. Two identical wall sconces are mounted on both sides of the bed at about 1.6 m", f"{HALLWAY}. Two identical wall sconces flank the mirror",
          f"{LOFT_LIVING}. Two identical wall sconces are mounted on the accent wall above the sofa", f"{CLASSIC_LIVING}. Two identical wall sconces flank the fireplace mirror"],
    "C": [f"{OPEN_LIVING}. The ceiling light is mounted flush on the ceiling", f"{BEDROOM}. The ceiling light is mounted flush on the ceiling", f"{HALLWAY}. The ceiling light is mounted flush on the ceiling"],
    "F": [f"{JAPANDI_LIVING}. The floor lamp stands beside the sofa", f"{LOFT_LIVING}. The floor lamp stands beside the sofa", f"{BEDROOM}. The floor lamp stands in the corner by the window"],
    "T": [f"{BEDROOM}. The table lamp stands on the bedside table", f"{CLASSIC_LIVING}. The table lamp stands on a brass side table", f"{INDUSTRIAL_DINING}. The table lamp stands on the black sideboard"],
}
LIGHT = ("Time of day: late evening — windows show a deep blue dusk or night sky with distant city lights, no daylight. The lamp from the reference is switched on "
         "and is the main light source, warm 3000K glow with realistic light falloff and soft shadows; only subtle warm accent lighting elsewhere. ")


def top_cropped(raw):
    """Чи торкається світильник верхнього краю референсу (кріплення обрізане): у верхніх 2% рядків є пікселі, помітно відмінні від фону."""
    im = Image.open(io.BytesIO(raw)).convert("L"); im.thumbnail((400, 400))
    w, h = im.size; px = im.load()
    bg = sorted(px[x, y] for x, y in [(0, h - 1), (w - 1, h - 1), (0, h // 2), (w - 1, h // 2)])[2]
    rows = max(2, h // 50)
    hits = sum(1 for y in range(rows) for x in range(w) if abs(px[x, y] - bg) > 40)
    return hits > rows * 2  # більше ~2 «предметних» пікселів на рядок — щось виходить за верхній край


_turn = {}


def pick(key):
    """Сцени по черзі (з випадкового старту), щоб у партії не повторювався один стиль."""
    i = _turn.setdefault(key, random.randrange(len(SCENES[key])))
    _turn[key] = i + 1
    return SCENES[key][i % len(SCENES[key])]


def build_prompt(code, base, cropped_top=False):
    """Сцена з SCENES (почергово/випадково), розміри — з промпту функції; кадр з функції лишаємо для O."""
    kind = code.split("-")[1][0]
    if kind == "O": return base
    if kind == "L": key = "L_long" if "long side parallel" in base else "L"
    elif kind == "P": key = "P_long" if "long side parallel" in base else "P_small" if "Three identical" in base else "P"
    else: key = kind
    lamp = {"L": "chandelier", "P": "pendant light", "W": "wall sconce", "F": "floor lamp", "T": "table lamp", "C": "ceiling light"}[kind]
    m = re.search(r"The [a-z ]+ is about [^;]*;[^.]*\.", base)
    size = (m.group(0) + " ") if m else ""
    # 24.11 власник: світильники все ще завеликі → на 15–20% менше для всіх типів
    big = ((f"The room is spacious with a 2.8–3 m ceiling; the {lamp} takes no more than about one fifth of the frame width, "
            f"clearly smaller than the sofa or table beneath it, with plenty of empty ceiling around it. ") if kind in "LPC" else "") + \
          (f"Show the {lamp} about 20% smaller in the frame than in a typical product-focused shot, at true real-world scale relative to the furniture "
           f"and the room; it must never look oversized. ")
    # 24.11 власник: на референсах з обрізаним верхом кріплення вигадувалось навмання → так само не показуємо його
    crop = (f"IMPORTANT: in the reference photo the top of the {lamp} (ceiling canopy, mount and suspension) is cut off and not visible. "
            f"Do NOT invent any mount, canopy, rods or cables: frame the shot so the upper part of the {lamp} is cut off by the top edge of the image "
            f"in the same way as in the reference, so the mount stays out of view. ") if cropped_top and kind in "LP" else ""
    return (f"Use the attached product photo as the exact reference for the {lamp}. Scene: {pick(key)}. {crop}{size}{big}{LIGHT}"
            f"Photorealistic interior photography, {'28mm' if kind in 'LPC' else '35mm'} lens, natural composition, lived-in and styled, "
            f"no people, no text, no logos, no watermarks, no other decorative lamps except those described. "
            f"Keep the {lamp}'s design exactly as in the reference: same shape, proportions, number of arms, tiers and shades, every decorative detail "
            f"(openwork, texture, pattern of the shades), materials, glass and metal color, the same type of suspension and EXACTLY the same number "
            f"of ceiling canopies and suspension points as in the reference — do not add or remove any.")


def gen_local(code, model):
    import base64, urllib.parse
    p = req("prompt", code=code)
    if "error" in p: return p
    raw0 = urllib.request.urlopen(urllib.request.Request(p["photo"], headers={"user-agent": "Mozilla/5.0 SvitloPlaza"}), timeout=60).read()
    p["prompt"] = build_prompt(code, p["prompt"], top_cropped(raw0))
    raw = raw0
    ref = Image.open(io.BytesIO(raw)).convert("RGB"); ref.thumbnail((1600, 1600), Image.LANCZOS)
    rb = io.BytesIO(); ref.save(rb, "JPEG", quality=90)
    body = {"contents": [{"role": "user", "parts": [{"inline_data": {"mime_type": "image/jpeg", "data": base64.b64encode(rb.getvalue()).decode()}}, {"text": p["prompt"]}]}],
            "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": "4:5", "imageSize": SIZE}}}
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
    up = urllib.request.Request(f"{GEN}?action=add&code={code}&model={model}", data=save_webp(out, 84), method="PUT",
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
        r = put_photo("PUT", code, n, save_webp(im, 82))
        site = next((u for u in r["photos_ai"] if f"_int_{n}-" in u), None)
        req("decide", "POST", {"id": c["id"], "status": "published", "site_url": site})
        print(f"{code} #{n}: на сайті → https://www.svitloplaza.store/p/{code.lower()}")
    print(f"опубліковано: {len(rows)}")


def main(a):
    global SIZE
    model, par = opt(a, "--model", "gemini-3.1-flash-image"), int(opt(a, "--par", "4"))
    SIZE = opt(a, "--size", SIZE)
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
