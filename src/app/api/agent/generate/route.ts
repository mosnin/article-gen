import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { checkCredits } from "@/lib/credits";
import { acquireGenerationSlot, releaseGenerationSlot } from "@/lib/rate-limit";
import { createAgentRun, updateAgentRunStatus } from "@/lib/agent-runs";
import { triggerAgentRun } from "@/lib/modal-client";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

type GenerateRequest = {
  kind?: "article" | "autopilot" | "cluster" | "research_only";
  topic: string;
  focusKeyword?: string;
  tone?: string;
  targetAudience?: string;
  quality?: "standard" | "premium";
  options?: {
    imageCount?: number;
    autoPublish?: boolean;
    platforms?: Array<{ kind: string; id: string }>;
    maxSimilar?: number;
    dedupThreshold?: number;
  };
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = user.id;

  let body: GenerateRequest;
  try {
    body = (await req.json()) as GenerateRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.topic || typeof body.topic !== "string" || body.topic.trim().length === 0) {
    return NextResponse.json({ error: "Topic is required" }, { status: 400 });
  }
  if (body.topic.length > 300) {
    return NextResponse.json({ error: "Topic must be 300 characters or fewer" }, { status: 400 });
  }
  if (body.focusKeyword && (typeof body.focusKeyword !== "string" || body.focusKeyword.length > 150)) {
    return NextResponse.json({ error: "Focus keyword must be 150 characters or fewer" }, { status: 400 });
  }

  const kind: NonNullable<GenerateRequest["kind"]> = body.kind || "article";
  const quality: NonNullable<GenerateRequest["quality"]> = body.quality || "standard";
  const creditsNeeded = quality === "premium" ? 3 : 1;

  // Pre-check credits. The actual deduction happens inside the run via the deduct_credit tool.
  const creditCheck = await checkCredits(supabase, userId, creditsNeeded);
  if (!creditCheck.allowed) {
    return NextResponse.json(
      { error: "Insufficient credits. Please upgrade your plan or wait for your monthly reset." },
      { status: 402 }
    );
  }

  const slotAcquired = await acquireGenerationSlot(supabase, userId);
  if (!slotAcquired) {
    return NextResponse.json(
      { error: "Too many concurrent generations (max 5). Please wait for a generation to complete." },
      { status: 429 }
    );
  }

  let run;
  try {
    run = await createAgentRun({
      userId,
      kind,
      topic: body.topic,
      focusKeyword: body.focusKeyword,
      tone: body.tone,
      targetAudience: body.targetAudience,
      quality,
      input: body as unknown as Record<string, unknown>,
      options: body.options ?? {},
    });
  } catch (error: unknown) {
    logger.error("Failed to create agent run", error);
    await releaseGenerationSlot(supabase, userId);
    return NextResponse.json({ error: "Failed to create run" }, { status: 500 });
  }

  try {
    const trigger = await triggerAgentRun({
      runId: run.id,
      userId,
      kind,
      topic: body.topic,
      focusKeyword: body.focusKeyword,
      tone: body.tone,
      targetAudience: body.targetAudience,
      quality,
      options: body.options ?? {},
    });
    await updateAgentRunStatus({ runId: run.id, modalCallId: trigger.modalCallId });
    return NextResponse.json({ runId: run.id, status: "pending" });
  } catch (error: unknown) {
    logger.error("Failed to trigger agent run", error);
    await updateAgentRunStatus({
      runId: run.id,
      status: "failed",
      error: error instanceof Error ? error.message : "trigger_failed",
    });
    await releaseGenerationSlot(supabase, userId);
    return NextResponse.json({ error: "Failed to trigger agent run" }, { status: 502 });
  }
}
