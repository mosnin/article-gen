import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type ListBody = {
  userId: string;
  limit?: number;
};

type GeneratedImage = {
  type?: string;
  altText?: string | null;
  storagePath?: string;
  publicUrl?: string;
  success?: boolean;
};

type ArticleRow = {
  id: string;
  title: string | null;
  generated_images: unknown;
};

function isListBody(v: unknown): v is ListBody {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.userId !== "string" || r.userId.trim() === "") return false;
  if (r.limit !== undefined && typeof r.limit !== "number") return false;
  return true;
}

function normaliseImages(raw: unknown): GeneratedImage[] {
  if (!Array.isArray(raw)) return [];
  const out: GeneratedImage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    out.push({
      type: typeof r.type === "string" ? r.type : "",
      altText:
        typeof r.altText === "string"
          ? r.altText
          : r.altText === null
            ? null
            : "",
      storagePath: typeof r.storagePath === "string" ? r.storagePath : "",
      publicUrl: typeof r.publicUrl === "string" ? r.publicUrl : "",
      success: typeof r.success === "boolean" ? r.success : true,
    });
  }
  return out;
}

export async function POST(req: Request) {
  const auth = await requireInternalAuth(req);
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });

  let parsed: unknown;
  try {
    parsed = JSON.parse(auth.rawBody);
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!isListBody(parsed)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const limit = Math.min(200, Math.max(1, parsed.limit ?? 200));
  const sb = getAdminClient();
  const { data, error } = await sb
    .from("articles")
    .select("id, title, generated_images")
    .eq("user_id", parsed.userId)
    .eq("lifecycle", "published")
    .filter("generated_images", "neq", "[]")
    .not("generated_images", "is", null)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    return Response.json(
      { error: "query_failed", detail: error.message },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as ArticleRow[];
  const articles = rows
    .map((a) => ({
      id: a.id,
      title: a.title ?? "",
      generatedImages: normaliseImages(a.generated_images),
    }))
    .filter((a) => a.generatedImages.length > 0);

  return Response.json({ articles });
}
