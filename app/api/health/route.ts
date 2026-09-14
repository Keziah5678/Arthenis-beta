import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "Arthenis",
    features: {
      coherenceEngine: Boolean(process.env.OPENAI_API_KEY),
      imageGeneration: Boolean(process.env.OPENAI_API_KEY),
      supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    }
  });
}
