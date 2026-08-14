/**
 * POST /api/stt
 * Receives an audio file (multipart/form-data), sends it to Sarvam AI
 * /speech-to-text endpoint with saaras:v3 model, returns the transcript
 * plus latency breakdown.
 *
 * Expected form fields:
 *   - audio: Blob (audio/webm, audio/wav, audio/mp3, etc.)
 *   - mode: optional ("transcribe" | "translate" | "verbatim" | "translit" | "codemix")
 *   - languageCode: optional BCP-47 code
 */
import { NextRequest, NextResponse } from "next/server";
import { transcribeAudio, SarvamSttError } from "@/lib/sarvam";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const t0 = performance.now();
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio");
    const mode = (formData.get("mode") as string | null) ?? undefined;
    const languageCode = (formData.get("languageCode") as string | null) ?? undefined;

    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json(
        { ok: false, error: "Missing 'audio' field in form data." },
        { status: 400 }
      );
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const audio = Buffer.from(arrayBuffer);
    if (audio.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Audio buffer is empty." },
        { status: 400 }
      );
    }

    const result = await transcribeAudio({
      audio,
      mimeType: audioFile.type || "audio/webm",
      filename: audioFile.name || `audio-${Date.now()}.webm`,
      mode: mode as any,
      languageCode: languageCode || undefined,
      timeoutMs: 30_000,
      maxRetries: 2,
    });

    return NextResponse.json({
      ok: true,
      transcript: result.transcript,
      languageCode: result.languageCode,
      languageProbability: result.languageProbability,
      requestId: result.requestId,
      sttLatencyMs: result.latencyMs,
      attempts: result.attempts,
      audioSizeBytes: audio.length,
      audioMimeType: audioFile.type,
      totalLatencyMs: performance.now() - t0,
    });
  } catch (e) {
    const status = e instanceof SarvamSttError ? (e.statusCode ?? 500) : 500;
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        ok: false,
        error: message,
        sttLatencyMs: performance.now() - t0,
      },
      { status }
    );
  }
}
