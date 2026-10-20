import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Поки без R2-кешу (сторінки рендеряться на запит). R2 підключимо, коли знадобиться.
export default defineCloudflareConfig({});
