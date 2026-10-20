"""Шифрування 3D-моделі для сайту (вимога ліцензії 3D-baza: не давати відвідувачам доступ до файлу моделі).
GLB → XOR-потік з ключем → public/m/<name>.bin. Розшифровка — src/lib/model.ts.
Запуск: python3 scripts/encode_model.py вхід.glb public/m/sphere.bin
"""
import hashlib, sys
KEY = b"svitlo-plaza/sp-p1228/2026"
data = open(sys.argv[1], "rb").read()
out = bytearray(len(data)); block = b""; i = 0
while i < len(data):
    block = hashlib.sha256(KEY + i.to_bytes(8, "little")).digest()
    for j in range(32):
        if i + j >= len(data): break
        out[i + j] = data[i + j] ^ block[j]
    i += 32
open(sys.argv[2], "wb").write(bytes(out))
print(len(out), "bytes")
