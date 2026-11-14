"use client";
// Кнопка «Показати ще» з індикатором: поки вантажиться наступна порція — «Завантаження…» (раніше кнопка «мовчала», Clarity фіксував мертві кліки).
import Link, { useLinkStatus } from "next/link";

function Label({ count }: { count: number }) {
  const { pending } = useLinkStatus();
  return pending ? <span className="lm-wait">Завантаження…</span> : <>Показати ще <b>{count}</b></>;
}

export default function LoadMore({ href, count }: { href: string; count: number }) {
  return <Link href={href} scroll={false} rel="nofollow"><Label count={count} /></Link>;
}
