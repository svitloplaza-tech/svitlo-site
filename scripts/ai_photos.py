"""ШІ-інтер'єри (Firefly) → сайт. Файли {код}_int_{N}.jpg|png|webp (напр. SP-L327_int_1.jpg).

  AI_SECRET=… python3 scripts/ai_photos.py папка_або_файли…      завантажити (webp ≤2000 px, q82)
  AI_SECRET=… python3 scripts/ai_photos.py --list SP-L327
  AI_SECRET=… python3 scripts/ai_photos.py --remove SP-L327 2

Edge-функція ai-photos: Storage kolekciya/ai/{код}/…, models.photos_ai (галерея — одразу після головного фото,
фід Merchant — першими в additional_image_link, sitemap — <image:image>). Секрет — vault 'ai_upload_secret'.
"""
import io, os, re, sys, json, urllib.request
from pathlib import Path
from PIL import Image

FN = "https://teidqxvftoihhwmubiyf.supabase.co/functions/v1/ai-photos"
RX = re.compile(r"^(SP-[A-Za-z]\d+(?:\.\d+)?)_int_(\d)\.(jpe?g|png|webp)$", re.I)


def call(method, code, n=None, body=None):
    url = f"{FN}?code={code}" + (f"&n={n}" if n else "")
    req = urllib.request.Request(url, data=body, method=method, headers={"x-ai-secret": os.environ["AI_SECRET"], "content-type": "image/webp"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


def webp(p: Path) -> bytes:
    im = Image.open(p)
    im = im.convert("RGB")
    im.thumbnail((2000, 2000), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, "WEBP", quality=82, method=6)
    return b.getvalue()


def main(a):
    if a[:1] == ["--list"]: return print(json.dumps(call("GET", a[1].upper()), ensure_ascii=False, indent=1))
    if a[:1] == ["--remove"]: return print(json.dumps(call("DELETE", a[1].upper(), a[2]), ensure_ascii=False, indent=1))
    files = [f for x in a for f in (sorted(Path(x).iterdir()) if Path(x).is_dir() else [Path(x)])]
    for f in files:
        m = RX.match(f.name)
        if not m: print("пропуск (ім'я не {код}_int_{N}):", f.name); continue
        code, n = m.group(1).upper(), m.group(2)
        r = call("PUT", code, n, webp(f))
        print(f"{code} #{n}: OK → https://www.svitloplaza.store/p/{r['slug']} ({len(r['photos_ai'])} кадр.)")


if __name__ == "__main__":
    main(sys.argv[1:])
