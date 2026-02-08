import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase-server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { prompt, type, altText } = await req.json() as {
      prompt: string;
      type: string;
      altText: string;
    };

    if (!prompt || !type) {
      return NextResponse.json({ error: "Prompt and type are required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API key is not configured." }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey });

    const response = await openai.images.generate({
      model: "gpt-image-1-mini",
      prompt,
      n: 1,
      size: "1536x1024",
      quality: "medium",
    });

    const imageData = response.data?.[0];
    if (imageData && imageData.b64_json) {
      return NextResponse.json({
        image: {
          type,
          altText,
          b64: imageData.b64_json,
          success: true,
        },
      });
    }

    return NextResponse.json({
      image: { type, altText, b64: null, success: false },
      error: "Image generation returned no data",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
