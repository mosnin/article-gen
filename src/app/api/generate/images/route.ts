import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase-server";
import { uploadImage, getPublicUrl } from "@/lib/supabase-admin";
import { acquireGenerationSlot, releaseGenerationSlot } from "@/lib/rate-limit";
import { checkCredits, deductCredit } from "@/lib/credits";
import { logger } from "@/lib/logger";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check credits before consuming resources
  const { allowed } = await checkCredits(supabase, user.id, 1);
  if (!allowed) {
    return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
  }

  const slotAcquired = await acquireGenerationSlot(supabase, user.id);
  if (!slotAcquired) {
    return NextResponse.json(
      { error: "Too many concurrent generations (max 5). Please wait for a generation to complete." },
      { status: 429 }
    );
  }

  try {
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

    // Deduct credit before making the OpenAI call
    const deduction = await deductCredit(supabase, user.id, articleId, "Image generation");
    if (!deduction.success) {
      return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
    }

    const openai = new OpenAI({ apiKey });

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1792x1024",
      quality: "standard",
    });

    const imageData = response.data?.[0];
    if (!imageData?.url && !imageData?.b64_json) {
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
        let buffer: Buffer;
        if (imageData.b64_json) {
          buffer = Buffer.from(imageData.b64_json, "base64");
        } else {
          // dall-e-3 returns a URL; fetch and store it
          const imgRes = await fetch(imageData.url!);
          buffer = Buffer.from(await imgRes.arrayBuffer());
        }
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
        publicUrl: publicUrl ?? imageData.url ?? null,
        success: true,
      },
    });
  } catch (error: unknown) {
    logger.error("Failed to generate images", error);
    return NextResponse.json({ error: "Failed to generate images" }, { status: 500 });
  } finally {
    await releaseGenerationSlot(supabase, user.id);
  }
}
