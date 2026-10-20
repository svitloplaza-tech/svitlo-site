import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Старі адреси товарів з QR-кодів у PDF: /p/{код} — зберігаємо як є.
  poweredByHeader: false,
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
