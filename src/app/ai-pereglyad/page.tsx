import type { Metadata } from "next";
import AiReview from "@/components/AiReview";

// Службова сторінка: затвердження ШІ-інтер'єрів. Відкривати за посиланням /ai-pereglyad#k=СЕКРЕТ (секрет — у хеші, на сервер не йде).
export const metadata: Metadata = { title: "Перегляд ШІ-інтер'єрів", robots: { index: false, follow: false } };
export default function Page() {
  return <main className="wrap section"><AiReview /></main>;
}
