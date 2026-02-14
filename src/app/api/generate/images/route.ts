import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase-server";
import { uploadImage, getPublicUrl } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const authResult = await requireUser(supabase);
    if ("response" in authResult) return authResult.response;
    const { user } = authResult;

    const limit = checkRateLimit(`generate:images:${user.id}`, { windowMs: 60_000, max: 30 });
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
    }

    const { prompt, type, altText, articleId, imageIndex } = await req.json() as {
      prompt: string;
      type: string;
      altText: string;
      articleId?: string;
      imageIndex?: number;
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
    if (!imageData?.b64_json) {
      return NextResponse.json({
        image: { type, altText, storagePath: null, publicUrl: null, success: false },
        error: "Image generation returned no data",
      });
    }

    // Save to Supabase Storage if articleId is provided
    let storagePath: string | null = null;
    let publicUrl: string | null = null;

    if (articleId) {
      try {
        const filename = imageIndex === 0 ? "featured" : `image-${imageIndex ?? 0}`;
        const buffer = Buffer.from(imageData.b64_json, "base64");
        storagePath = await uploadImage(user.id, articleId, filename, buffer);
        publicUrl = getPublicUrl(storagePath);
      } catch {
        // Storage save failed - image was still generated, return what we can
      }
    }

    return NextResponse.json({
      image: {
        type,
        altText,
        storagePath,
        publicUrl,
        success: true,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
