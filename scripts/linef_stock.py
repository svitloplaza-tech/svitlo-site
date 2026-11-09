"""Щотижневе оновлення наявності LineF (і звіт змін цін).

Крок 1 (цей скрипт, `scrape`): бере з Supabase усі активні варіанти LineF (sku, url_supplier, price),
відкриває сторінки linef.com.ua і читає `var stocks` (quantity, expected_at) та ціну.
Результат — scripts/out/linef_stock.json.
Крок 2 (`sql`): порівнює результат із поточними даними сайту і пише scripts/out/linef_update.sql —
один запит лише з тими позиціями, що змінились (дані вшиті у VALUES, без тимчасових таблиць).
Його виконують одним викликом execute_sql (див. docs/LINEF_WEEKLY.md). Оновлення variants робить SQL, не скрипт.
(Старий шлях `upload` через тимчасову таблицю tmp_stock залишено як запасний.)

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


SQL_OUT = OUT.parent / "linef_update.sql"
UPDATE = """x as (select sku, case when qty>0 then 'В наявності' when exp then 'Очікується' else 'Немає в наявності' end a, qty>0 s, price from d),
st as (update variants v set availability=x.a, in_stock=x.s, updated_at=now() from x
       where v.sku=x.sku and v.supplier='LineF' and (v.availability is distinct from x.a or v.in_stock<>x.s) returning x.a),
cand as (select v.sku, v.price old, x.price new from x join variants v using(sku)
         where v.supplier='LineF' and x.price is not null and x.price>0 and v.price is not null and x.price<>v.price),
pr as (update variants v set price=c.new, price_supplier=c.new,
         old_price=case when v.old_price is not null and c.new>=v.old_price then null else v.old_price end, updated_at=now()
       from cand c where v.sku=c.sku and c.new between c.old*0.5 and c.old*2 returning c.sku, c.old, c.new)
select (select count(*) from st) stock_changed,
       (select json_object_agg(a,n) from (select a,count(*) n from st group by a) t) by_status,
       (select count(*) from pr) prices_changed,
       (select count(*) from pr where new>old) up,
       (select count(*) from pr where new<old) down,
       (select json_agg(t) from (select sku, old, new from pr order by abs(new-old) desc limit 5) t) top_price,
       (select json_agg(t) from (select * from cand where not (new between old*0.5 and old*2)) t) suspicious;
"""


def current():
    rows, off = {}, 0
    while True:
        r = requests.get(f"{URL}/rest/v1/variants", headers={**H, "Range": f"{off}-{off+999}"},
                         params={"select": "sku,availability,in_stock,price", "supplier": "eq.LineF", "order": "sku"}, timeout=60)
        r.raise_for_status(); j = r.json()
        rows.update({v["sku"]: v for v in j})
        if len(j) < 1000: return rows
        off += 1000


def sql():
    out = json.loads(OUT.read_text())
    bad = sum(1 for r in out.values() if "err" in r)
    if not out or bad > 0.2 * len(out):
        sys.exit(f"СТОП: помилок {bad} з {len(out)} (>20%) — нічого не оновлювати")
    cur = current(); vals = []
    for k, r in out.items():
        if "err" in r or k not in cur: continue
        c = cur[k]
        a = "В наявності" if r["qty"] > 0 else "Очікується" if r["exp"] else "Немає в наявності"
        if c["availability"] == a and c["in_stock"] == (r["qty"] > 0) and not (r["price"] and r["price"] != c["price"]):
            continue
        p = "null" if not r["price"] else str(int(r["price"]))
        vals.append(f"('{k.replace(chr(39), chr(39)*2)}',{int(r['qty'])},{'true' if r['exp'] else 'false'},{p})")
    if not vals:
        SQL_OUT.write_text(""); print("змін немає — SQL не потрібен"); return
    SQL_OUT.write_text("with d(sku,qty,exp,price) as (values\n" + ",\n".join(vals) + "),\n" + UPDATE)
    print(f"позицій зі змінами: {len(vals)}; помилок сторінок: {bad}; SQL: {SQL_OUT} ({SQL_OUT.stat().st_size} байт)")


if __name__ == "__main__":
    {"scrape": scrape, "upload": upload, "sql": sql}[sys.argv[1]]()
