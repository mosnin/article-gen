import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { isWasabiConfigured, presignUpload, presignDownload } from "@/lib/wasabi";
import { logger } from "@/lib/logger";

/**
 * Presigned Wasabi URLs, session-authenticated.
 *  POST { filename, contentType }  → { key, uploadUrl, expiresInSeconds }
 *  POST { downloadKey }            → { downloadUrl, expiresInSeconds }
 * Clients then PUT/GET directly against Wasabi over HTTPS — file bytes
 * never pass through this server.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await (async () => {
      try {
        const supabase = await createClient();
        const { data: { user: u } } = await supabase.auth.getUser();
        return u;
      } catch {
        return null; // fail closed on backend misconfiguration
      }
    })();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!isWasabiConfigured()) {
      return NextResponse.json(
        { error: "File storage is not configured (Wasabi env vars missing)" },
        { status: 501 },
      );
    }

    const body = await req.json() as { filename?: string; contentType?: string; downloadKey?: string };

    if (body.downloadKey) {
      const result = await presignDownload(user.id, body.downloadKey);
      return NextResponse.json(result);
    }

    if (!body.filename || typeof body.filename !== "string" || body.filename.length > 300) {
      return NextResponse.json({ error: "filename is required (max 300 chars)" }, { status: 400 });
    }
    const contentType =
      typeof body.contentType === "string" && /^[\w.+-]+\/[\w.+-]+$/.test(body.contentType)
        ? body.contentType
        : "application/octet-stream";

    const result = await presignUpload({ userId: user.id, filename: body.filename, contentType });
    return NextResponse.json(result);
  } catch (error: unknown) {
    logger.error("storage presign failed", error);
    const message = error instanceof Error ? error.message : "Presign failed";
    const status = message === "Invalid storage key" ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
