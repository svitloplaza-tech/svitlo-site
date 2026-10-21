import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";
import memoryQueue from "@opennextjs/cloudflare/overrides/queue/memory-queue";

// Кеш сторінок і даних у Cloudflare KV (безкоштовно; ліміт 1000 записів/добу — тому довгі revalidate).
// Простір KV створює сам wrangler під час деплою (binding NEXT_INC_CACHE_KV у wrangler.jsonc без id).
export default defineCloudflareConfig({ incrementalCache: kvIncrementalCache, queue: memoryQueue });
