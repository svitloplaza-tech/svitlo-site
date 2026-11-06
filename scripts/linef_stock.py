"""Щотижневе оновлення наявності LineF (і звіт змін цін).

Крок 1 (цей скрипт, `scrape`): бере з Supabase усі активні варіанти LineF (sku, url_supplier, price),
відкриває сторінки linef.com.ua і читає `var stocks` (quantity, expected_at) та ціну.
Результат — scripts/out/linef_stock.json.
Крок 2 (`upload`): надсилає результат у тимчасову таблицю public.tmp_stock (її створює й видаляє той,
хто запускає, через SQL — див. docs/LINEF_WEEKLY.md). Оновлення variants робить SQL, не скрипт.

Правило: quantity > 0 → «В наявності»; 0 і є expected_at → «Очікується»; інакше «Немає в наявності».
Сторінки, що не відкрились після повторів, НЕ змінюються. LineF ріже часті запити — 4 потоки з паузами.
"""
import json, re, sys, time, random, pathlib, concurrent.futures as cf
import requests

URL = "https://teidqxvftoihhwmubiyf.supabase.co"
KEY = "sb_publishable_Sm2y9bo0N-Zx-FfnfUWAqg_k9CidQkt"
H = {"apikey": KEY, "Authorization": "Bearer " + KEY}
OUT = pathlib.Path(__file__).parent / "out" / "linef_stock.json"


def variants():
    rows, off = [], 0
    while True:
        r = requests.get(f"{URL}/rest/v1/variants", headers={**H, "Range": f"{off}-{off+999}"},
                         params={"select": "sku,url_supplier,price", "supplier": "eq.LineF", "is_active": "eq.true", "order": "sku"}, timeout=60)
        r.raise_for_status(); j = r.json(); rows += j
        if len(j) < 1000: return rows
        off += 1000


S = requests.Session()
S.headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36"


def one(v):
    err = ""
    for a in range(4):
        try:
            time.sleep(random.uniform(0.2, 0.6))
            x = S.get(v["url_supplier"], timeout=30)
            if x.status_code == 404:
                return v["sku"], {"err": "404"}
            x.raise_for_status()
            h = x.text
            st = re.search(r"var stocks = (\[.*?\]);", h, re.S)
            if not st:
                return v["sku"], {"err": "немає stocks"}
            st = json.loads(st.group(1))
            pr = re.search(r'itemprop="price" content="([\d.]+)"', h) or re.search(r'"price":\s*([\d.]+)', h)
            return v["sku"], {"qty": sum(s.get("quantity") or 0 for s in st),
                              "exp": any(s.get("expected_at") for s in st),
                              "price": round(float(pr.group(1))) if pr else None, "old": v["price"]}
        except Exception as e:
            err = str(e)[:120]; time.sleep(3 * (a + 1))
    return v["sku"], {"err": err}


def scrape():
    vs = variants(); out = {}
    with cf.ThreadPoolExecutor(4) as ex:
        for i, (k, r) in enumerate(ex.map(one, vs)):
            out[k] = r
            if i % 500 == 0: print(i, "/", len(vs), flush=True)
    OUT.parent.mkdir(exist_ok=True); OUT.write_text(json.dumps(out, ensure_ascii=False))
    ok = [r for r in out.values() if "err" not in r]
    print(f"готово: {len(ok)} з {len(out)}; помилок {len(out)-len(ok)}; "
          f"змін ціни {sum(1 for r in ok if r['price'] and r['old'] and r['price'] != r['old'])}")


def upload():
    out = json.loads(OUT.read_text())
    rows = [{"sku": k, "qty": r["qty"], "exp": r["exp"], "price": r["price"]} for k, r in out.items() if "err" not in r]
    for i in range(0, len(rows), 1000):
        x = requests.post(f"{URL}/rest/v1/tmp_stock", headers={**H, "Content-Type": "application/json", "Prefer": "return=minimal"},
                          json=rows[i:i+1000], timeout=120)
        print(x.status_code, x.text[:200])
        x.raise_for_status()
    print("надіслано", len(rows))


if __name__ == "__main__":
    {"scrape": scrape, "upload": upload}[sys.argv[1]]()
