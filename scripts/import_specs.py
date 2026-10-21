"""Характеристики товарів → фільтри каталогу.
1) python3 scripts/import_specs.py scrape   — збирає таблицю «Характеристики» і габарити з кожної сторінки LineF (variants.url_supplier) у specs.jsonl
2) python3 scripts/import_specs.py upload   — рахує models.facets (нормалізовані значення фільтрів) і записує variants.specs + models.facets
   через тимчасову Edge-функцію import-specs (IMPORT_URL, IMPORT_KEY у змінних середовища).
Власна Колекція (без сторінок LineF) — значення беруться з опису models.description.
"""
import json, re, html, os, sys, time, urllib.request, concurrent.futures as cf

SB = "https://teidqxvftoihhwmubiyf.supabase.co/rest/v1"
PUB = "sb_publishable_Sm2y9bo0N-Zx-FfnfUWAqg_k9CidQkt"
WORK = os.environ.get("SPECS_DIR", ".")

def rest(path):
    out = []
    for o in range(0, 100000, 1000):
        r = urllib.request.Request(f"{SB}/{path}&offset={o}&limit=1000", headers={"apikey": PUB})
        d = json.load(urllib.request.urlopen(r)); out += d
        if len(d) < 1000: return out

# ---------- 1. збір ----------
def fetch(r):
    for _ in range(3):
        try:
            s = urllib.request.urlopen(urllib.request.Request(r["url_supplier"], headers={"User-Agent": "Mozilla/5.0"}), timeout=30).read().decode("utf8", "ignore")
            i = s.find("id='characteristics'"); t = s[i:s.find("</table>", i)] if i > 0 else ""
            sp = {}
            for th, td in re.findall(r"<th>(.*?)</th>\s*<td>(.*?)</td>", t, flags=re.S):
                vals = [html.unescape(re.sub(r"<[^>]+>", "", v)).strip() for v in re.split(r"</a>\s*,\s*", td)]
                sp[html.unescape(th).strip()] = [v for v in vals if v]
            st = re.search(r"var stocks = (\[.*?\]);", s)
            if st:
                try:
                    j = (json.loads(st.group(1)) or [{}])[0]
                    sp["_dims"] = {k: j.get(k) for k in ("length", "width", "height", "weight")}
                except Exception: pass
            return {"sku": r["sku"], "status": 200, "specs": sp}
        except urllib.error.HTTPError as e:
            if e.code == 404: return {"sku": r["sku"], "status": 404}
            time.sleep(2)
        except Exception: time.sleep(2)
    return {"sku": r["sku"], "status": 0}

def scrape():
    rows = rest("variants?select=sku,url_supplier,supplier&is_active=eq.true&supplier=eq.LineF&order=sku")
    path = os.path.join(WORK, "specs.jsonl"); done = set()
    if os.path.exists(path): done = {json.loads(l)["sku"] for l in open(path)}
    todo = [r for r in rows if r["sku"] not in done and r["url_supplier"]]
    with open(path, "a") as f, cf.ThreadPoolExecutor(6) as ex:
        for k, res in enumerate(ex.map(fetch, todo)):
            f.write(json.dumps(res, ensure_ascii=False) + "\n")
            if k % 200 == 0: print(k, flush=True)

# ---------- 2. нормалізація ----------
ROOMS = [("вітал", "Вітальня"), ("спаль", "Спальня"), ("їдаль", "Їдальня"), ("кухн", "Кухня"), ("дитяч", "Дитяча"),
         ("коридор", "Коридор"), ("передпок", "Передпокій"), ("ванн", "Ванна"), ("кабінет", "Кабінет"), ("офіс", "Офіс")]
def num(x):
    m = re.search(r"\d+(?:[.,]\d+)?", str(x)); return float(m.group().replace(",", ".")) if m else None
def temps(vals):
    out = set()
    for v in vals:
        if not v: continue
        if "rgb" in v.lower(): out.add("rgb")
        ns = [int(n) for n in re.findall(r"\d{4}", v)]
        if len(ns) >= 2 or "+" in v: out.add("cct")
        for n in ns:
            out.add("warm" if n <= 3200 else "neutral" if n < 5000 else "cold")
    return out
def rng(a, vals):
    vals = [v for v in vals if v]
    if vals: a[:] = [min(vals + a[:1]), max(vals + a[1:2])] if a else [min(vals), max(vals)]

def facets_for(model, variants, specs):
    f = {"sub": None, "w": [], "l": [], "h": [], "temp": set(), "socket": set(), "lamps": set(), "shape": set(),
         "shade": set(), "rooms": set(), "feat": set(), "mat": set()}
    cat = model.get("category_supplier") or ""
    if ">" in cat and not model.get("own"): f["sub"] = cat.split(">")[-1].strip()
    text = " ".join([model.get("title") or "", model.get("description") or ""]).lower()
    for v in variants:
        sp = specs.get(v["sku"]) or {}
        d = sp.get("_dims") or {}
        rng(f["w"], [num(d.get("width"))]); rng(f["l"], [num(d.get("length"))]); rng(f["h"], [num(d.get("height"))])
        f["temp"] |= temps((sp.get("Світлова температура") or []) + [v.get("temp")])
        f["socket"] |= {("GU10" if "GU10" in x.upper() else x.upper()) for x in sp.get("Цоколь", [])}
        for x in sp.get("Кількість ламп", []):
            n = num(x); n and f["lamps"].add(int(n))
        f["shape"] |= set(sp.get("Форма", []))
        f["shade"] |= set(sp.get("Колір плафона", []))
        f["mat"] |= set(sp.get("Матеріал корпусу", []))
        for r in sp.get("Тип приміщення", []):
            for k, name in ROOMS:
                if k in r.lower(): f["rooms"].add(name)
        if "Є" in sp.get("Наявність пульта д/у", []): f["feat"].add("remote")
        if "Є" in sp.get("Режим нічника", []): f["feat"].add("night")
        if sp.get("Керування зі смартфона"): f["feat"].add("smart")
    # власна Колекція та доповнення з опису
    if not f["socket"]:
        for s_ in re.findall(r"\b(E27|E14|G9|G4|GU10|GX53|LED)\b", text.upper()): f["socket"].add(s_)
    if not f["lamps"]:
        m = re.search(r"×\s*(\d+)", text) or re.search(r"на (\d+) ламп", text)
        if m: f["lamps"].add(int(m.group(1)))
    if not (f["w"] or f["h"]):
        m = re.search(r"розміри:\s*(\d+)\s*[×x]\s*(\d+)(?:\s*[×x]\s*(\d+))?\s*мм", text)
        if m:
            a = [int(x) / 10 for x in m.groups() if x]
            if all(x < 400 for x in a):  # відсікаємо явні помилки в описах
                f["w"] = [a[0], a[0]]; f["h"] = [a[-1], a[-1]]
    if not f["temp"]: f["temp"] = temps(re.findall(r"\d{4}\s*k", text))
    if "пульт" in text: f["feat"].add("remote")
    if not f["rooms"]:
        for k, name in ROOMS:
            if k in text: f["rooms"].add(name)
    out = {}
    for k, v in f.items():
        if isinstance(v, set): v = sorted(v)
        if v: out[k] = v
    return out

def upload():
    url, key = os.environ.get("IMPORT_URL"), os.environ.get("IMPORT_KEY")
    def post(table, rows):
        for i in range(0, len(rows), 400):
            req = urllib.request.Request(url, data=json.dumps({"table": table, "rows": rows[i:i + 400]}, ensure_ascii=False).encode(),
                                         headers={"content-type": "application/json", "x-import-key": key})
            print(table, i, urllib.request.urlopen(req, timeout=300).read().decode()[:200], flush=True)
    specs = {}
    for l in open(os.path.join(WORK, "specs.jsonl")):
        r = json.loads(l)
        if r.get("specs"): specs[r["sku"]] = r["specs"]
    models = rest("models?select=code,title,description,category_supplier,own,kind_code&is_active=eq.true&order=code")
    variants = rest("variants?select=sku,model_code,temp&is_active=eq.true&order=sku")
    by = {}
    for v in variants: by.setdefault(v["model_code"], []).append(v)
    fac = [{"key": m["code"], "value": facets_for(m, by.get(m["code"], []), specs)} for m in models]
    json.dump(fac, open(os.path.join(WORK, "facets.json"), "w"), ensure_ascii=False)
    if "--dry" in sys.argv: print("dry", len(fac)); return
    post("variants", [{"key": k, "value": v} for k, v in specs.items()])
    post("models", fac)

if __name__ == "__main__":
    {"scrape": scrape, "upload": upload}[sys.argv[1]]()
