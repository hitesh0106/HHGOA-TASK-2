/**
 * GET /api/datasets
 * Returns metadata about the loaded dataset subset (count, language
 * distribution, sample documents) for the UI's data explorer panel.
 */
import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const subsetPath = path.join(process.cwd(), "data", "msmarco-xi-subset.json");
    const raw = await readFile(subsetPath, "utf8");
    const data = JSON.parse(raw) as { docs: any[]; count: number };

    // Aggregate stats
    const byLang: Record<string, number> = {};
    let withQuery = 0;
    let withAnswer = 0;
    let totalTextChars = 0;
    for (const d of data.docs) {
      byLang[d.language] = (byLang[d.language] ?? 0) + 1;
      if (d.query) withQuery++;
      if (d.answer) withAnswer++;
      totalTextChars += (d.text?.length ?? 0);
    }

    // Sample (first 5 docs)
    const sample = data.docs.slice(0, 5).map((d) => ({
      id: d.id,
      language: d.language,
      textPreview: (d.text ?? "").slice(0, 280),
      query: d.query ?? "",
      answer: d.answer ?? "",
      textLength: (d.text ?? "").length,
    }));

    return NextResponse.json({
      ok: true,
      source: "ai4bharat/MSMARCO-XI",
      count: data.count,
      byLang,
      withQuery,
      withAnswer,
      avgTextChars: data.count > 0 ? Math.round(totalTextChars / data.count) : 0,
      sample,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Dataset not loaded. Run `python scripts/fetch_msmarco_streaming.py` and `python scripts/ingest_msmarco.py` first.",
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 503 }
    );
  }
}
