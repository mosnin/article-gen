import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { sweepScheduledPublishes } from "@/lib/publish/scheduled";

/**
 * Manual / external trigger for the scheduled-publish sweep, guarded by
 * CRON_SECRET. The primary trigger is the Inngest function
 * scheduled-publish-cron (every 5 minutes); this route exists for external
 * schedulers and one-off manual kicks.
 */

export const maxDuration = 60;

function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = Buffer.from(a);
  const bBytes = Buffer.from(b);
  if (aBytes.length !== bBytes.length) {
    // Still do a comparison to avoid timing leaks on length
    crypto.timingSafeEqual(aBytes, aBytes);
    return false;
  }
  return crypto.timingSafeEqual(aBytes, bBytes);
}

async function handleCron(req: NextRequest): Promise<Response> {
  const authHeader = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || !timingSafeEqual(authHeader, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sweepScheduledPublishes(10);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sweep failed" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}
