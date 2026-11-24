"""Позначка ШІ для Google (Merchant Center, 24.11): IPTC DigitalSourceType = trainedAlgorithmicMedia у XMP файлу WebP.

  save_webp(im, quality) -> bytes   — нове кодування одразу з XMP
  add_xmp(webp_bytes) -> bytes       — додати/замінити XMP у готовому WebP БЕЗ перекодування (чанк RIFF «XMP »)
  has_ai_mark(webp_bytes) -> bool
"""
import io, struct
from PIL import Image

XMP = (
    '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>'
    '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
    '<rdf:Description rdf:about="" xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/" '
    'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/">'
    '<Iptc4xmpExt:DigitalSourceType>http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia</Iptc4xmpExt:DigitalSourceType>'
    '<photoshop:Credit>Svitlo Plaza (AI-generated interior, Google Gemini)</photoshop:Credit>'
    '<dc:description><rdf:Alt><rdf:li xml:lang="x-default">AI-generated interior visualization</rdf:li></rdf:Alt></dc:description>'
    '</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>'
).encode("utf-8")


def save_webp(im: Image.Image, quality=82) -> bytes:
    b = io.BytesIO()
    im.save(b, "WEBP", quality=quality, method=6, xmp=XMP)
    return add_xmp(b.getvalue())  # нормалізуємо (Pillow іноді не пише xmp без VP8X)


def _chunks(data: bytes):
    i = 12
    while i + 8 <= len(data):
        tag, size = data[i:i + 4], struct.unpack("<I", data[i + 4:i + 8])[0]
        yield tag, data[i + 8:i + 8 + size]
        i += 8 + size + (size & 1)


def _chunk(tag: bytes, payload: bytes) -> bytes:
    return tag + struct.pack("<I", len(payload)) + payload + (b"\0" if len(payload) & 1 else b"")


def add_xmp(data: bytes) -> bytes:
    assert data[:4] == b"RIFF" and data[8:12] == b"WEBP", "не WebP"
    ch = [(t, p) for t, p in _chunks(data) if t != b"XMP "]
    if ch[0][0] == b"VP8X":
        flags = bytearray(ch[0][1]); flags[0] |= 0x04
        ch[0] = (b"VP8X", bytes(flags))
    else:  # простий формат (VP8/VP8L) → додаємо VP8X з розміром полотна
        im = Image.open(io.BytesIO(data)); w, h = im.size
        alpha = 0x10 if im.mode in ("RGBA", "LA") else 0
        vp8x = bytes([0x04 | alpha, 0, 0, 0]) + (w - 1).to_bytes(3, "little") + (h - 1).to_bytes(3, "little")
        ch.insert(0, (b"VP8X", vp8x))
    body = b"WEBP" + b"".join(_chunk(t, p) for t, p in ch) + _chunk(b"XMP ", XMP)
    return b"RIFF" + struct.pack("<I", len(body)) + body


def has_ai_mark(data: bytes) -> bool:
    return any(t == b"XMP " and b"trainedAlgorithmicMedia" in p for t, p in _chunks(data))
