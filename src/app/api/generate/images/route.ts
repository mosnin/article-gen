import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase-server";
import { deductCredit } from "@/lib/credits";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { prompts } = await req.json() as {
      prompts: Array<{ type: string; prompt: string; altText: string }>;
    };

    if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
      return NextResponse.json({ error: "Image prompts are required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API key is not configured." }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey });

    // Generate images in parallel (max 4)
    const imagePrompts = prompts.slice(0, 4);
    const results = await Promise.all(
      imagePrompts.map(async (img) => {
        try {
          const response = await openai.images.generate({
            model: "gpt-image-1-mini",
            prompt: img.prompt,
            n: 1,
            size: "1536x1024",
            quality: "medium",
          });

          const imageData = response.data?.[0];
          if (imageData && imageData.b64_json) {
            return {
              type: img.type,
              altText: img.altText,
              b64: imageData.b64_json,
              success: true,
            };
          }

          return { type: img.type, altText: img.altText, b64: null, success: false };
        } catch (err) {
          console.error(`Image generation failed for "${img.type}":`, err);
          return { type: img.type, altText: img.altText, b64: null, success: false };
        }
      })
    );

    const successCount = results.filter((r) => r.success).length;

    // Deduct 1 credit for image generation
    if (successCount > 0) {
      const deductResult = await deductCredit(supabase, user.id, undefined, "AI image generation");
      return NextResponse.json({
        images: results,
        credits: deductResult.credits,
      });
    }

    return NextResponse.json({
      images: results,
      error: "All image generations failed",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
