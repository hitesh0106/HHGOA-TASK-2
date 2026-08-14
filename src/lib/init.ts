/**
 * Vector store initialization
 * ==========================
 *
 * Loads all pre-computed vector stores and the IDF map into memory at
 * server startup. Idempotent - safe to call multiple times.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { getVectorStore, getAllLoadedStrategies } from "./vector-db";
import { setIdf } from "./embeddings";
import { CHUNKING_STRATEGIES } from "./chunking";

let initPromise: Promise<{ loaded: string[]; idfLoaded: boolean }> | null = null;

export async function ensureVectorStoresLoaded(): Promise<{
  loaded: string[];
  idfLoaded: boolean;
}> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const dir = path.join(process.cwd(), "data", "vector-stores");

    // Load IDF (shared across strategies)
    let idfLoaded = false;
    try {
      const idfRaw = await readFile(path.join(dir, "_idf.json"), "utf8");
      const idf = JSON.parse(idfRaw) as Record<string, number>;
      setIdf(idf);
      idfLoaded = true;
    } catch {
      // IDF missing is non-fatal; embeddings will fall back to pure TF
    }

    // Load all four strategies
    for (const s of CHUNKING_STRATEGIES) {
      const store = getVectorStore(s);
      if (store.isLoaded) continue;
      try {
        await store.load(s, dir);
        console.log(`[vector-db] loaded strategy "${s}": ${store.size} chunks`);
      } catch {
        // missing strategy is non-fatal; retrieval will surface a clear error
      }
    }

    return { loaded: getAllLoadedStrategies(), idfLoaded };
  })();
  return initPromise;
}

/**
 * Initialize on module import in server contexts.
 * We use a try/catch so that build-time evaluation doesn't fail when the
 * data files are absent (e.g., during `next build`).
 */
if (typeof window === "undefined") {
  ensureVectorStoresLoaded().catch((e) => {
    console.warn("[vector-db] init failed:", e instanceof Error ? e.message : e);
  });
}
