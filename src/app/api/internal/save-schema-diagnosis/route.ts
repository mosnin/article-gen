import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const ALLOWED_VALIDATION_STATUSES = [
  "pending",
  "valid",
  "invalid",
  "warnings",
] as const;
type ValidationStatus = (typeof ALLOWED_VALIDATION_STATUSES)[number];

type SaveSchemaDiagnosisBody = {
  userId: string;
  runId: string | null;
  articleId: string;
  currentSchema: Record<string, unknown> | null;
  recommendedSchema: Record<string, unknown>;
  recommendations: Array<Record<string, unknown>>;
  validationStatus: ValidationStatus;
  validationErrors: string[];
};

function isValidationStatus(v: unknown): v is ValidationStatus {
  return (
    typeof v === "string" &&
    (ALLOWED_VALIDATION_STATUSES as readonly string[]).includes(v)
  );
}

function isObjectOrNull(v: unknown): v is Record<string, unknown> | null {
  if (v === null) return true;
  return typeof v === "object" && !Array.isArray(v);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function isObjectArray(v: unknown): v is Array<Record<string, unknown>> {
  return Array.isArray(v) && v.every((x) => isObject(x));
}

function isSaveBody(v: unknown): v is SaveSchemaDiagnosisBody {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.userId !== "string" || r.userId.trim() === "") return false;
  if (r.runId !== null && typeof r.runId !== "string") return false;
  if (typeof r.articleId !== "string" || r.articleId.trim() === "") return false;
  if (!isObjectOrNull(r.currentSchema)) return false;
  if (!isObject(r.recommendedSchema)) return false;
  if (!isObjectArray(r.recommendations)) return false;
  if (!isValidationStatus(r.validationStatus)) return false;
  if (!isStringArray(r.validationErrors)) return false;
  return true;
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
  if (!isSaveBody(parsed)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const body = parsed;

  const sb = getAdminClient();
  const { data, error } = await sb
    .from("schema_diagnoses")
    .insert({
      user_id: body.userId,
      run_id: body.runId && body.runId !== "" ? body.runId : null,
      article_id: body.articleId,
      current_schema: body.currentSchema,
      recommended_schema: body.recommendedSchema,
      recommendations: body.recommendations,
      validation_status: body.validationStatus,
      validation_errors: body.validationErrors,
    })
    .select("id")
    .single();

  if (error || !data) {
    return Response.json(
      { error: "insert_failed", detail: error?.message ?? "unknown" },
      { status: 500 },
    );
  }

  return Response.json({ diagnosisId: (data as { id: string }).id });
}
