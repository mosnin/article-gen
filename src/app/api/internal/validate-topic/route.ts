import { requireInternalAuth } from "@/lib/agent-auth";

export const runtime = "nodejs";

type ValidateTopicBody = {
  niche: string;
  title: string;
  focusKeyword: string;
  evidenceUrls: string[];
};

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function isValidateTopicBody(v: unknown): v is ValidateTopicBody {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.niche !== "string") return false;
  if (typeof r.title !== "string") return false;
  if (typeof r.focusKeyword !== "string") return false;
  if (!isStringArray(r.evidenceUrls)) return false;
  return true;
}

function nicheTerms(niche: string): string[] {
  return niche
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length >= 3);
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
  if (!isValidateTopicBody(parsed)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const body = parsed;

  const reasons: string[] = [];

  const titleLower = body.title.toLowerCase();
  const focusLower = body.focusKeyword.toLowerCase();
  const terms = nicheTerms(body.niche);
  const hasNicheTerm =
    terms.length === 0
      ? true
      : terms.some((t) => titleLower.includes(t) || focusLower.includes(t));
  if (!hasNicheTerm) {
    reasons.push(
      "no niche term (>=3 chars) appears in title or focusKeyword",
    );
  }

  if (body.evidenceUrls.length < 3) {
    reasons.push(
      `only ${body.evidenceUrls.length} evidence URLs, need at least 3`,
    );
  }

  for (const url of body.evidenceUrls) {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      reasons.push(`evidence URL is not http(s): ${url}`);
    }
  }

  return Response.json({ valid: reasons.length === 0, reasons });
}
