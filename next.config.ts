import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Старі адреси товарів з QR-кодів у PDF: /p/{код} — зберігаємо як є.
  poweredByHeader: false,
  async redirects() {
    return [
      // основна адреса — з www (QR-коди PDF ведуть на svitloplaza.store/p/… — теж працюють через переадресацію)
      { source: "/:path*", has: [{ type: "host", value: "svitloplaza.store" }], destination: "https://www.svitloplaza.store/:path*", permanent: true },
      // старий WordPress-сайт
      { source: "/product-category/:path*", destination: "/katalog", permanent: true },
      { source: "/shop", destination: "/katalog", permanent: true },
      { source: "/shop/:path*", destination: "/katalog", permanent: true },
    ];
  },
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
