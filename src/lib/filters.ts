// Фільтри каталогу (як на LineF, без бренду). Значення — з models.facets (scripts/import_specs.py).
import { FAMILIES, type CatalogModel } from "./catalog";

export type Facets = {
  sub?: string; w?: number[]; l?: number[]; h?: number[]; temp?: string[]; socket?: string[]; lamps?: number[];
  shape?: string[]; shade?: string[]; rooms?: string[]; feat?: string[];
};
type M = CatalogModel & { facets?: Facets | null };
type Group = { id: string; name: string; get: (m: M) => string[]; label?: (v: string) => string; order?: string[] };
type Range = { id: string; name: string; get: (m: M) => number[] | undefined };

const LAMPS: [string, (n: number) => boolean][] = [["1", (n) => n === 1], ["2–3", (n) => n >= 2 && n <= 3], ["4–6", (n) => n >= 4 && n <= 6],
  ["7–10", (n) => n >= 7 && n <= 10], ["11–20", (n) => n >= 11 && n <= 20], ["21+", (n) => n > 20]];
const TEMP: Record<string, string> = { warm: "Тепле (до 3200K)", neutral: "Нейтральне (3500–4500K)", cold: "Холодне (від 5000K)", cct: "Змінна температура", rgb: "Кольорове RGB" };
const FEAT: Record<string, string> = { remote: "З пультом", night: "Режим нічника", smart: "Керування зі смартфона" };

export const GROUPS: Group[] = [
  { id: "pidkat", name: "Підкатегорія", get: (m) => (m.facets?.sub ? [m.facets.sub] : []) },
  { id: "kolir", name: "Колір корпусу", get: (m) => FAMILIES.filter((f) => (m.colors ?? []).some((c) => f.test(c))).map((f) => f.id),
    label: (v) => FAMILIES.find((f) => f.id === v)?.name ?? v, order: FAMILIES.map((f) => f.id) },
  { id: "prymishchennia", name: "Приміщення", get: (m) => m.facets?.rooms ?? [] },
  { id: "temp", name: "Світлова температура", get: (m) => m.facets?.temp ?? [], label: (v) => TEMP[v] ?? v, order: Object.keys(TEMP) },
  { id: "forma", name: "Форма", get: (m) => m.facets?.shape ?? [] },
  { id: "tsokol", name: "Цоколь", get: (m) => m.facets?.socket ?? [] },
  { id: "lampy", name: "Кількість ламп", get: (m) => LAMPS.filter(([, t]) => (m.facets?.lamps ?? []).some(t)).map(([k]) => k), order: LAMPS.map(([k]) => k) },
  { id: "plafon", name: "Колір плафона", get: (m) => m.facets?.shade ?? [] },
  { id: "osoblyvosti", name: "Особливості", get: (m) => m.facets?.feat ?? [], label: (v) => FEAT[v] ?? v, order: Object.keys(FEAT) },
];
export const RANGES: Range[] = [
  { id: "tsina", name: "Ціна, ₴", get: (m) => (m.price_from != null ? [m.price_from, m.price_from] : undefined) },
  { id: "shyryna", name: "Ширина / діаметр, см", get: (m) => m.facets?.w },
  { id: "dovzhyna", name: "Довжина, см", get: (m) => m.facets?.l },
  { id: "vysota", name: "Висота, см", get: (m) => m.facets?.h },
];

export type OptionView = { v: string; label: string; n: number };
export type GroupView = { id: string; name: string; options: OptionView[]; sel: string[] };
export type RangeView = { id: string; name: string; min: number; max: number; sel: [number | null, number | null] };

type SP = Record<string, string | undefined>;
const list = (s?: string) => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const parseRange = (s?: string): [number | null, number | null] => {
  const [a, b] = (s ?? "").split("-").map((x) => (x === "" || x == null ? null : Number(x)));
  return [Number.isFinite(a as number) ? (a as number) : null, Number.isFinite(b as number) ? (b as number) : null];
};

/** Фільтрує список і рахує кількість товарів для кожного значення (з урахуванням інших вибраних фільтрів). */
export function applyFilters(all: M[], sp: SP) {
  const sel = Object.fromEntries(GROUPS.map((g) => [g.id, list(sp[g.id])]));
  const rsel = Object.fromEntries(RANGES.map((r) => [r.id, parseRange(sp[r.id])])) as Record<string, [number | null, number | null]>;
  const stock = sp.nayavnist === "1";
  const okGroup = (m: M, g: Group) => !sel[g.id].length || g.get(m).some((v) => sel[g.id].includes(v));
  const okRange = (m: M, r: Range) => {
    const [a, b] = rsel[r.id]; if (a == null && b == null) return true;
    const x = r.get(m); if (!x?.length) return false;
    return (a == null || x[1] >= a) && (b == null || x[0] <= b);
  };
  const base = all.filter((m) => !stock || m.in_stock);
  const okExcept = (m: M, skip?: string) => GROUPS.every((g) => g.id === skip || okGroup(m, g)) && RANGES.every((r) => r.id === skip || okRange(m, r));
  const result = base.filter((m) => okExcept(m));

  const groups: GroupView[] = GROUPS.map((g) => {
    const pool = base.filter((m) => okExcept(m, g.id)), cnt = new Map<string, number>();
    for (const m of pool) for (const v of new Set(g.get(m))) cnt.set(v, (cnt.get(v) ?? 0) + 1);
    let options = [...cnt].map(([v, n]) => ({ v, label: g.label ? g.label(v) : v, n }));
    options = g.order ? options.sort((a, b) => g.order!.indexOf(a.v) - g.order!.indexOf(b.v)) : options.sort((a, b) => b.n - a.n);
    for (const v of sel[g.id]) if (!cnt.has(v)) options.push({ v, label: g.label ? g.label(v) : v, n: 0 });
    return { id: g.id, name: g.name, options, sel: sel[g.id] };
  }).filter((g) => g.options.length > 1 || g.sel.length);

  const ranges: RangeView[] = RANGES.map((r) => {
    const xs = base.map((m) => r.get(m)).filter((x): x is number[] => !!x?.length);
    return { id: r.id, name: r.name, min: Math.floor(Math.min(...xs.map((x) => x[0]))), max: Math.ceil(Math.max(...xs.map((x) => x[1]))), sel: rsel[r.id], n: xs.length };
  }).filter((r) => r.n > 3 && r.max > r.min).map(({ n: _n, ...r }) => r);

  const active = GROUPS.reduce((s, g) => s + sel[g.id].length, 0) + RANGES.filter((r) => rsel[r.id][0] != null || rsel[r.id][1] != null).length;
  return { result, groups, ranges, active };
}
