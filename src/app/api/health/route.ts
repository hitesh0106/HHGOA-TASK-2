/**
 * GET /api/health
 * Returns system health, loaded vector stores, and dataset stats.
 */
import { NextResponse } from "next/server";
import { getAllLoadedStrategies, getVectorStore } from "@/lib/vector-db";
import { getIdf } from "@/lib/embeddings";
import { ensureVectorStoresLoaded } from "@/lib/init";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // Ensure vector stores are loaded (idempotent)
  await ensureVectorStoresLoaded();

  const strategies = getAllLoadedStrategies();
  const stores = strategies.map((s) => {
    const st = getVectorStore(s);
    return {
      strategy: s,
      loaded: st.isLoaded,
      chunks: st.size,
      docs: st.totalDocs,
    };
  });
  const idf = getIdf();

  // Read summary if present
  let summary: unknown = null;
  try {
    const summaryPath = path.join(process.cwd(), "data", "vector-stores", "_summary.json");
    summary = JSON.parse(await readFile(summaryPath, "utf8"));
  } catch {
    // not present yet
  }

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    sarvamApiKeyConfigured: Boolean(process.env.SARVAM_API_KEY),
    vectorStores: stores,
    idfLoaded: idf !== null,
    idfSize: idf?.size ?? 0,
    summary,
  });
}
