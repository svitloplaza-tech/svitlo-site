"""Імпорт каталогу Svitlo Plaza у Supabase (svitlo-site).

Джерело: архів SvitloPlaza_robochi_dani.zip → out/catalog_enriched.json (LineF) + out/own_catalog.json (Колекція)
та назви з catalog_build/names_vol*.py. Перший імпорт виконано 20.10.2026: 1442 серії, 2382 моделі, 4933 варіанти.

Запуск (повторний імпорт / оновлення через upsert):
  SUPABASE_URL=... SUPABASE_SECRET_KEY=... python3 scripts/import_catalog.py /шлях/до/robochi_dani
Секретний ключ: Supabase → Project Settings → API Keys → Secret. Не комітити.
"""
import json, os, re, sys, urllib.request

ROOT = sys.argv[1] if len(sys.argv) > 1 else "/home/claude/rd"
sys.path.insert(0, f"{ROOT}/catalog_build")
import names_vol1, names_vol2, names_vol3, names_vol456  # noqa: E402

NAMES, TITLES, SINGLES = {}, {}, {}
for n in (names_vol1, names_vol2, names_vol3, names_vol456):
    NAMES.update(n.SERIES); TITLES.update(n.T); SINGLES.update(n.SINGLES)
D = json.load(open(f"{ROOT}/out/catalog_enriched.json")); O = json.load(open(f"{ROOT}/out/own_catalog.json"))
NAMES.update({s["series"]: s["name"] for s in O["series"] if s.get("name")})

def title(m):
    c = m["model_code"]
    if m.get("own"): return m["name"]
    if c in SINGLES: return SINGLES[c]
    if c in TITLES:
        n = NAMES.get(m["series"], "")
        return TITLES[c].replace("{N}", n.capitalize() if n else "").replace("  ", " ").strip()
    return m["name"]

def num(s):
    d = re.sub(r"\D", "", str(s or "")); return int(d) if d else None

URL = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/"
KEY = os.environ["SUPABASE_SECRET_KEY"]

def upsert(table, rows, key):
    for i in range(0, len(rows), 500):
        req = urllib.request.Request(f"{URL}{table}?on_conflict={key}", data=json.dumps(rows[i:i+500]).encode(), method="POST",
            headers={"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json",
                     "Prefer": "resolution=merge-duplicates,return=minimal"})
        urllib.request.urlopen(req, timeout=120)
    print(table, len(rows))

ser = D["series"] + O["series"]; mods = D["models"] + O["models"]; var = D["variants"] + O["variants"]
order = {c: i for s in ser for i, c in enumerate(s["models"])}
upsert("series", [dict(id=s["series"], number=s["number"], name=NAMES.get(s["series"]) if len(s["models"]) > 1 else None,
                       own=bool(s.get("own")), standalone=len(s["models"]) == 1) for s in ser], "id")
upsert("models", [dict(code=m["model_code"], series_id=m["series"], kind_code=m["model_code"][3], kind_name=m["kind"], title=title(m),
                       supplier_name=m["name"], description=m.get("description") or None, photo=m.get("photo") or None,
                       photo_interior=m.get("photo_interior") or None, category_supplier=m.get("category_supplier"),
                       supplier="Svitlo Plaza" if m.get("own") else "LineF", supplier_root=m.get("supplier_root"),
                       own=bool(m.get("own")), sort=order.get(m["model_code"], 0)) for m in mods], "code")
rows = []
for v in var:
    own = v.get("supplier") == "Svitlo Plaza"; p = num(v["price_supplier"])
    rows.append(dict(sku=v["sku"], model_code=v["model_code"], supplier=v["supplier"], supplier_sku=v.get("supplier_sku"),
                     size=v.get("size") or None, color=v.get("color") or None, color_code=v.get("color_code") or None, temp=v.get("temp") or None,
                     price=p, price_supplier=(v.get("price_site_old") if own else p), old_price=num(v.get("old_price_supplier")),
                     availability=v.get("availability"), in_stock=v.get("availability") == "В наявності", url_supplier=v.get("url_supplier"),
                     photo=v.get("photo") or None, photos=v.get("photos_all") or []))
upsert("variants", rows, "sku")
