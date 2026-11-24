"""Разово (24.11): додати позначку ШІ (XMP IPTC trainedAlgorithmicMedia) в усі вже опубліковані ШІ-кадри без перекодування
і записати ai_candidates.site_url (зв'язок кадр на сайті ↔ кандидат, потрібен для позначки «точно збігається»).
Нове ім'я файлу (кеш /f/ — рік). AI_SECRET=… python3 scripts/ai_retro_xmp.py [--par 6]
"""
import json, os, re, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from ai_xmp import add_xmp, has_ai_mark  # noqa: E402
from ai_photos import call as photos  # noqa: E402
from ai_batch import req  # noqa: E402

num = lambda u: int(re.search(r"_int_(\d+)", u).group(1))


def one(code, cands):
    out = []
    for u in sorted(photos("GET", code)["photos_ai"], key=num):
        n = num(u)
        raw = urllib.request.urlopen(u, timeout=120).read()
        if has_ai_mark(raw): new = u
        else:
            r = photos("PUT", code, n, add_xmp(raw))
            new = next(x for x in r["photos_ai"] if f"_int_{n}-" in x)
        out.append(new)
    if cands:
        if len(cands) != len(out): return f"{code}: кадрів {len(out)}, кандидатів {len(cands)} — site_url не записано"
        for c, u in zip(sorted(cands, key=lambda c: c["id"]), out):
            req("decide", "POST", {"id": c["id"], "site_url": u})
    return f"{code}: ok {len(out)}"


def safe(c):
    try: return one(c, BY.get(c, []))
    except Exception as e: return f"{c}: помилка {e!r}"[:200]


BY = {}
if __name__ == "__main__":
    par = int(sys.argv[sys.argv.index("--par") + 1]) if "--par" in sys.argv else 6
    pub = req("list", status="published", limit=2000)
    for c in pub: BY.setdefault(c["model_code"], []).append(c)
    codes = sorted(set(BY) | {"SP-L327"})
    bad = 0
    with ThreadPoolExecutor(par) as ex:
        for r in ex.map(safe, codes):
            if "ok" not in r: bad += 1; print(r)
    print(f"моделей {len(codes)}, проблем {bad}")
