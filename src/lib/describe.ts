/** Тексти для Google: title, meta description і опис на сторінці.
 *  Логіка: ручні тексти (models.seo / series.seo) → інакше збираємо з вступу серії (series.intro, пише людина/Claude)
 *  + фактів з бази (variants.specs, models.facets, опис Колекції). Лише факти з бази; биті значення відкидаються.
 *  Гарантія 12 міс. — лише для вбудованого LED-модуля (рішення власника 21.10). */

type Specs = Record<string, unknown> & { _dims?: { width?: number | null; height?: number | null; length?: number | null } };
export type DVariant = { size: string | null; color: string | null; temp: string | null; price: number | null; in_stock: boolean; specs?: Specs | null };
export type DModel = {
  code: string; title: string; kind_code: string; kind_name: string; description: string | null; own: boolean;
  facets?: Record<string, unknown> | null; seo?: { title?: string; desc?: string; body?: string[] } | null;
};
export type DSeries = { id: string; name: string | null; own: boolean; standalone: boolean; intro?: string | null;
  seo?: { title?: string; desc?: string; body?: string[] } | null } | null;
export type Texts = { title: string; desc: string; body: string[] };

const ROOMS: Record<string, string> = { "Вітальня": "вітальні", "Спальня": "спальні", "Кухня": "кухні", "Коридор": "коридору",
  "Передпокій": "передпокою", "Дитяча": "дитячої", "Ванна": "ванної", "Їдальня": "їдальні" };
const KIND_GEN: Record<string, string> = { L: "люстри", P: "підвісного світильника", W: "бра", C: "стельового світильника",
  T: "настільної лампи", F: "торшера", O: "вуличного світильника" };

const uniq = <T,>(a: T[]) => [...new Set(a.filter((x) => x !== null && x !== undefined && x !== "")) ];
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : typeof v === "string" ? [v] : []);
const lc = (s: string) => (/^[A-ZА-ЯІЇЄҐ]{2,}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));
function list(a: string[], max = 6): string {
  const b = a.slice(0, max);
  const more = a.length > max ? ` та ще ${a.length - max}` : "";
  return b.length <= 1 ? (b[0] ?? "") + more : b.slice(0, -1).join(", ") + (more ? ", " + b[b.length - 1] + more : " і " + b[b.length - 1]);
}
function hash(s: string) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
const pick = <T,>(code: string, salt: string, opts: T[]) => opts[hash(code + salt) % opts.length];
const num = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");
function range(a: number[], unit: string) {
  const v = uniq(a.filter((x) => Number.isFinite(x) && x > 0)).sort((x, y) => x - y) as number[];
  if (!v.length) return "";
  return v.length === 1 ? `${num(v[0])} ${unit}` : `${num(v[0])}–${num(v[v.length - 1])} ${unit}`;
}
/** Розмір варіанта придатний для тексту: має одиницю виміру або «лампи», без абсурдних чисел (биті розміри Колекції). */
function saneSize(s: string) {
  if (/^E\d/.test(s) || !/см|мм|ламп|Вт|×|x/i.test(s)) return false;
  const nums = (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map((x) => parseFloat(x.replace(",", ".")));
  if (/см/.test(s) && nums.some((n) => n > 400)) return false;
  return !nums.some((n) => n === 0);
}
function sizeKey(s: string) { const n = s.match(/\d+(?:[.,]\d+)?/g)?.map((x) => parseFloat(x.replace(",", "."))) ?? [0]; return n[0] * 1000 + (n[1] ?? 0); }
function field(desc: string | null, label: string) {
  const m = desc?.match(new RegExp(label + ":\\s*([^.]+(?:\\.\\d[^.]*)*)\\.", "i"));
  return m ? m[1].trim() : "";
}

type Facts = {
  colors: string[]; sizes: string[]; led: boolean; sockets: string[]; lamps: number[]; mat: string[]; diffuser: string[];
  temps: string[]; cct: boolean; power: string; mount: string; ip: string; rooms: string[]; dims: string; height: string;
  wall: string; switchOn: boolean; remote: boolean; night: boolean; smart: boolean; light: string; ownSizes: string;
};

export function facts(m: DModel, vs: DVariant[]): Facts {
  const f = (m.facets ?? {}) as Record<string, unknown>;
  const sp = (k: string) => uniq(vs.flatMap((v) => arr(v.specs?.[k])));
  const sockets = uniq([...arr(f.socket), ...sp("Цоколь")]);
  const ownLight = m.own ? field(m.description, "Світло") : "";
  const led = sockets.length > 0 ? sockets.every((s) => s === "LED") : /^LED/i.test(ownLight);
  const lamps = uniq([...(Array.isArray(f.lamps) ? (f.lamps as number[]) : []), ...sp("Кількість ламп").map(Number)]).filter((n) => n > 0 && n <= 24) as number[];
  const temps = sp("Світлова температура");
  const tf = arr(f.temp);
  const power = range(sp("Потужність, Вт").map((x) => parseFloat(x.replace(",", "."))).filter((x) => x >= 3), "Вт");
  const dimsOf = (k: "width" | "height" | "length") => vs.map((v) => Number(v.specs?._dims?.[k])).filter((n) => n > 0 && n < 400);
  const w = range([...dimsOf("width"), ...dimsOf("length")], "см"), h = range(dimsOf("height"), "см");
  const minH = sp("Мінімальна висота").map((x) => parseFloat(x)).filter((x) => x > 0), maxH = sp("Максимальна висота").map((x) => parseFloat(x)).filter((x) => x > 0 && x <= 400);
  const height = minH.length && maxH.length && Math.max(...maxH) > Math.min(...minH) ? `${num(Math.min(...minH))}–${num(Math.max(...maxH))} см` : "";
  const mount = sp("Тип кріплення")[0] ?? "";
  return {
    colors: uniq(vs.map((v) => v.color?.trim().toLowerCase() ?? "")),
    sizes: (uniq(vs.map((v) => v.size?.trim() ?? "")).filter(saneSize) as string[]).sort((a, b) => sizeKey(a) - sizeKey(b)),
    led, sockets: sockets.filter((s) => s !== "LED"), lamps,
    mat: uniq([...arr(f.mat), ...sp("Матеріал корпусу"), ...(m.own ? field(m.description, "матеріали").split(/,\s*/) : [])].map(lc)),
    diffuser: sp("Матеріал розсіювача").map(lc),
    temps, cct: tf.includes("cct") || temps.some((t) => /–|-/.test(t)), power,
    mount: mount ? lc(mount.replace(/монтажных/i, "монтажні")) : "",
    ip: sp("Ступінь захисту")[0] ?? "",
    rooms: arr(f.rooms).map((r) => ROOMS[r]).filter(Boolean),
    dims: [w && `ширина ${w}`, h && `висота ${h}`].filter(Boolean).join(", "),
    height, wall: sp("Відступ від стіни")[0] ?? "",
    switchOn: sp("Наявність вимикача на корпусі").includes("Є"),
    remote: arr(f.feat).includes("remote"), night: arr(f.feat).includes("night"), smart: arr(f.feat).includes("smart"),
    light: ownLight, ownSizes: m.own ? field(m.description, "Розміри") : "",
  };
}

function withTail(t: string, tail = " Доставка Новою Поштою.") { t = t.replace(/\. \.$/, "."); return t.length + tail.length <= 155 ? t + tail : clip(t, 155); }
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }
function clip(s: string, n: number) { if (s.length <= n) return s; const c = s.slice(0, n - 1); return c.slice(0, c.lastIndexOf(" ")).replace(/[,.;:—–-]+$/, "") + "…"; }

export function describeModel(m: DModel, vs: DVariant[], s: DSeries): Texts {
  const F = facts(m, vs);
  const prices = vs.map((v) => v.price).filter((p): p is number => !!p);
  const from = prices.length ? Math.min(...prices) : null;
  const name = m.title;

  // 1) Вступ: вступ серії (для серії з кількох моделей він про серію — додаємо, яке місце модель у ній займає)
  const p1: string[] = [];
  if (s?.intro) {
    p1.push(s.intro.trim());
  } else {
    const stem = m.kind_name.slice(0, 4).toLowerCase();
    if (!name.toLowerCase().startsWith(stem)) p1.push(`${name} — ${lc(m.kind_name)}.`);
  }

  // 2) Варіанти і світло
  const p2: string[] = [];
  const lampSizes = F.sizes.length > 1 && F.sizes.every((x) => /^\d+ ламп/.test(x));
  if (lampSizes) p2.push(`Варіанти: на ${list(F.sizes.map((x) => x.match(/^\d+/)![0]))} ${/^1\b/.test(F.sizes[F.sizes.length - 1]) ? "лампу" : "лампи"}.`);
  else if (F.sizes.length > 1) p2.push(pick(m.code, "z", [`Розміри: ${list(F.sizes, 8)}.`, `Доступні розміри — ${list(F.sizes, 8)}.`]));
  else if (F.sizes.length === 1) p2.push(`Розмір — ${F.sizes[0]}.`);
  else if (F.ownSizes && !/\d{5,}/.test(F.ownSizes)) p2.push(`Розміри: ${F.ownSizes}.`);
  if (F.dims && !F.sizes.length && !F.ownSizes) p2.push(`Габарити: ${F.dims}.`);
  if (F.height && ["P", "L"].includes(m.kind_code)) p2.push(`Висоту підвісу можна налаштувати в межах ${F.height}.`);
  if (F.colors.length > 1) p2.push(pick(m.code, "c", [`Кольори: ${list(F.colors, 8)}.`, `Обирайте колір: ${list(F.colors, 8)}.`]));
  else if (F.colors.length === 1) p2.push(`Колір — ${F.colors[0]}.`);
  const body = [F.mat.length && `корпус — ${list(F.mat, 3)}`, F.diffuser.length && `розсіювач — ${list(F.diffuser, 2)}`].filter(Boolean);
  if (body.length) p2.push(cap(body.join(", ")) + ".");
  if (F.led) {
    const t = F.cct ? "з перемиканням колірної температури" + (F.temps[0] ? ` (${F.temps[0].replace(/К$/, " K")})` : "")
      : F.temps.length > 1 ? `${F.temps.map((x) => x.replace(/К$/, " K")).sort().join(" або ")} залежно від варіанту`
      : F.temps.length ? F.temps[0].replace(/К$/, " K") : "";
    p2.push(`Світло — вбудований LED${F.power ? ` ${F.power}` : ""}${t ? ", " + t : ""}.`);
  } else if (F.light) p2.push(/^E\d/.test(F.light) ? `Під лампу ${F.light.replace(/ × 1$/, "")}${/×\s*[2-9]/.test(F.light) ? "" : ""} (у комплект не входить).` : `Світло: ${F.light}.`);
  else if (F.sockets.length) {
    const n = F.lamps.length ? (F.lamps.length === 1 ? `${F.lamps[0]} ${F.lamps[0] === 1 ? "лампа" : F.lamps[0] < 5 ? "лампи" : "ламп"}` : `від ${Math.min(...F.lamps)} до ${Math.max(...F.lamps)} ламп`) : "лампи";
    p2.push(`${cap(n)} з цоколем ${list(F.sockets, 3)} ${n.startsWith("1 ") ? "(у комплект не входить)" : "(у комплект не входять)"}.`);
  }
  const extra = [F.remote && "пульт дистанційного керування", F.night && "режим нічника", F.smart && "керування зі смартфона", F.switchOn && "вимикач на корпусі"].filter(Boolean) as string[];
  if (extra.length) p2.push(`Є ${list(extra)}.`);
  if (F.mount) p2.push(`Кріплення: ${F.mount}.`);
  if (F.wall && m.kind_code === "W") p2.push(`Відступ від стіни — ${F.wall}.`);
  if (F.ip) p2.push(`Ступінь захисту ${F.ip}.`);

  // 3) Де доречний + сервіс
  const p3: string[] = [];
  if (F.rooms.length) p3.push(pick(m.code, "r", [`Підійде для ${list(F.rooms)}.`, `Добре виглядає в інтер'єрі ${list(F.rooms)}.`]));
  if (F.led) p3.push("Гарантія — 12 місяців.");
  p3.push(pick(m.code, "d", ["Доставка Новою Поштою по всій Україні.", "Доставляємо Новою Поштою по Україні, оплата онлайн або при отриманні."]));

  const auto: Texts = {
    title: (name + " " + m.code).length <= 44 ? `${name} ${m.code}` : clip(name, 44),
    desc: withTail(`${name}${from ? ` — від ${from.toLocaleString("uk-UA")} грн` : ""}. ` + cap([
      F.sizes.length > 1 ? (F.sizes.every((x) => /^\d+ ламп/.test(x)) ? `на ${list(F.sizes.map((x) => x.match(/^\d+/)![0]))} лампи` : `${F.sizes.length} ${F.sizes.length < 5 ? "розміри" : "розмірів"}`) : "",
      F.colors.length > 1 ? `кольори: ${list(F.colors, 4)}` : F.colors[0] ?? "",
      F.led ? "вбудований LED" : F.sockets.length ? `цоколь ${F.sockets.join("/")}` : "",
    ].filter(Boolean).join(", ")) + "."),
    body: [p1.join(" "), p2.join(" "), p3.join(" ")].filter(Boolean),
  };
  const seo = m.seo ?? {};
  return { title: seo.title || auto.title, desc: seo.desc || auto.desc, body: seo.body?.length ? seo.body : auto.body };
}

export function describeSeries(s: NonNullable<DSeries>, models: { title: string; kind_code: string; price_from: number | null }[], kindNames: Record<string, string>): Texts {
  const name = cap((s.name ?? s.id).toLowerCase());
  const word = s.own ? "Колекція" : "Серія";
  const kinds = uniq(models.map((m) => kindNames[m.kind_code]?.toLowerCase() ?? "")) as string[];
  const prices = models.map((m) => m.price_from).filter((p): p is number => !!p);
  const from = prices.length ? Math.min(...prices) : null;
  const p2 = models.length > 1 ? `У ${s.own ? "колекції" : "серії"} ${models.length} ${models.length < 5 ? "моделі" : "моделей"}: ${list(models.map((m) => lc(m.title)), 10)}.` : "";
  const auto: Texts = {
    title: clip(`${word} ${name} — ${list(kinds, 3)}`, 50),
    desc: clip(`${word} світильників ${name}: ${list(kinds, 3)}${from ? `, від ${from.toLocaleString("uk-UA")} грн` : ""}. ${s.intro ?? ""}`, 155),
    body: [s.intro ?? "", p2, "Моделі однієї серії легко поєднувати між собою — для цілісного світла в кількох кімнатах."].filter(Boolean),
  };
  const seo = s.seo ?? {};
  return { title: seo.title || auto.title, desc: seo.desc || auto.desc, body: seo.body?.length ? seo.body : auto.body };
}
