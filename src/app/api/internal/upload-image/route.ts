import { requireInternalAuth } from "@/lib/agent-auth";
import { uploadImage, getPublicUrl } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type UploadBody = {
  userId: string;
  articleId: string;
  filename: string;
  base64Png: string;
};

export async function POST(req: Request) {
  const auth = await requireInternalAuth(req);
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: UploadBody;
  try {
    body = JSON.parse(auth.rawBody) as UploadBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.userId || !body.articleId || !body.filename || !body.base64Png) {
    return Response.json({ error: "missing_fields" }, { status: 400 });
  }

  try {
    const buf = Buffer.from(body.base64Png, "base64");
    const storagePath = await uploadImage(body.userId, body.articleId, body.filename, buf);
    const publicUrl = getPublicUrl(storagePath);
    return Response.json({ storagePath, publicUrl });
  } catch (e) {
    return Response.json(
      { error: "upload_failed", detail: String(e) },
      { status: 500 },
    );
  }
}
