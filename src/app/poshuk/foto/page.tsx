import type { Metadata } from "next";
import PhotoSearch from "./PhotoSearch";

export const metadata: Metadata = { title: "Пошук за фото", robots: { index: false } };

export default function Page() {
  return <PhotoSearch />;
}
