import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { isWasabiConfigured, listObjects, deleteObject } from "@/lib/wasabi";
import { logger } from "@/lib/logger";

/**
 * User file management, session-authenticated.
 *  GET               → { objects: [{key, size, lastModified}] }
 *  DELETE ?key=<key> → { deleted: true }
 * All operations are confined to the caller's users/<id>/uploads/ prefix.
 */

async function requireUser() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch {
    return null; // fail closed on backend misconfiguration
  }
}

export async function GET() {
  try {
    const user = await requireUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isWasabiConfigured()) {
      return NextResponse.json({ objects: [], configured: false });
    }
    const objects = await listObjects(user.id, { limit: 200 });
    return NextResponse.json({ objects, configured: true });
  } catch (error: unknown) {
    logger.error("storage list failed", error);
    return NextResponse.json({ error: "Failed to list files" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isWasabiConfigured()) {
      return NextResponse.json({ error: "File storage is not configured" }, { status: 501 });
    }
    const key = new URL(req.url).searchParams.get("key");
    if (!key) return NextResponse.json({ error: "key query param is required" }, { status: 400 });
    await deleteObject(user.id, key);
    return NextResponse.json({ deleted: true });
  } catch (error: unknown) {
    logger.error("storage delete failed", error);
    const message = error instanceof Error ? error.message : "Delete failed";
    const status = message === "Invalid storage key" ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
