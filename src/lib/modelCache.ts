/**
 * modelCache.ts — SPEC.md §6 F5: GCS caps `hand_landmarker.task`'s
 * freshness at `Cache-Control: public, max-age=3600`, so a plain
 * `modelAssetPath` fetch re-downloads the full ~7.8MB file on every visit
 * within the hour regardless of URL version-pinning (measured,
 * research/phase2-model-cards.md §P6's failure-mode table). Fixed at the
 * fetch layer: manually fetch + `caches.open()/.put()`, then hand
 * HandLandmarker the resulting bytes via `modelAssetBuffer`, never
 * `modelAssetPath` — the browser's HTTP cache is bypassed entirely in
 * favour of an explicit Cache Storage entry this code controls.
 */
const CACHE_NAME = "swage-model-v1";

export async function fetchModelBuffer(url: string): Promise<Uint8Array> {
  if (typeof caches === "undefined") {
    // No Cache Storage API (very old browser) — degrade to a plain fetch
    // rather than throwing; the model still loads, just without the fix.
    const response = await fetch(url);
    if (!response.ok) throw new Error(`model fetch failed: ${response.status} ${response.statusText}`);
    return new Uint8Array(await response.arrayBuffer());
  }

  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(url);
  if (cached) {
    return new Uint8Array(await cached.arrayBuffer());
  }

  const response = await fetch(url);
  if (!response.ok) throw new Error(`model fetch failed: ${response.status} ${response.statusText}`);
  // Response bodies are single-use — cache a clone, read the original.
  await cache.put(url, response.clone());
  return new Uint8Array(await response.arrayBuffer());
}
