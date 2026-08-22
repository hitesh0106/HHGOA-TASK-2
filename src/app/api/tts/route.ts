/**
 * ElevenLabs Voice TTS API Endpoint (/api/tts)
 * ============================================
 *
 * Implements high-fidelity ElevenLabs neural text-to-speech for voice:
 *   • Voice Name: Anika (Sweet, Expressive, Hinglish/Indian English)
 *   • Voice ID: UbB19hYD8fvYxwJAVTY5
 *   • Model: eleven_multilingual_v2
 *   • Fallback: Returns fallback flag if no API key is provided
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DEFAULT_ELEVENLABS_VOICE_ID = "UbB19hYD8fvYxwJAVTY5"; // Anika
export const DEFAULT_ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const voiceId =
      body.voiceId ||
      process.env.ELEVENLABS_VOICE_ID ||
      DEFAULT_ELEVENLABS_VOICE_ID;
    const modelId =
      body.modelId ||
      process.env.ELEVENLABS_MODEL_ID ||
      DEFAULT_ELEVENLABS_MODEL_ID;

    if (!text) {
      return NextResponse.json(
        { ok: false, error: "Missing text parameter" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      // Return metadata letting the client know to use local sweet Anika voice preset
      return NextResponse.json(
        {
          ok: false,
          fallback: true,
          reason:
            "ELEVENLABS_API_KEY not configured. Falling back to sweet Anika voice preset via Web Speech API.",
          voiceId,
          voiceName: "Anika (Hinglish/Indian English)",
        },
        { status: 200 }
      );
    }

    // Call ElevenLabs API
    const elevenUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;
    const elevenRes = await fetch(elevenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: 0.2,
          use_speaker_boost: true,
        },
      }),
    });

    if (!elevenRes.ok) {
      const errText = await elevenRes.text().catch(() => "");
      return NextResponse.json(
        {
          ok: false,
          fallback: true,
          error: `ElevenLabs error (${elevenRes.status}): ${errText}`,
          voiceId,
          voiceName: "Anika (Hinglish/Indian English)",
        },
        { status: 200 }
      );
    }

    const audioBuffer = await elevenRes.arrayBuffer();
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=3600",
        "X-ElevenLabs-Voice": voiceId,
        "X-ElevenLabs-Voice-Name": "Anika",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        fallback: true,
        error: err instanceof Error ? err.message : "TTS error",
        voiceId: DEFAULT_ELEVENLABS_VOICE_ID,
      },
      { status: 500 }
    );
  }
}
