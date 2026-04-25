import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const ARTICLE_HARD_CAP = 100;

type ListBody = {
  userId: string;
  limit?: number;
};

type SettingsRow = {
  niche: string | null;
  autopilot_niche: string | null;
  autonomous_schedules: unknown;
};

type ArticleRow = {
  title: string | null;
  focus_keyword: string | null;
  topic: string | null;
  keywords: string[] | null;
};

type AutonomousScheduleSummary = {
  name: string;
  niche: string;
  cadence: string;
};

type ArticleSummary = {
  title: string;
  focusKeyword: string;
  topic: string;
  keywords: string[];
};

function isListBody(v: unknown): v is ListBody {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.userId !== "string" || r.userId.trim() === "") return false;
  if (
    r.limit !== undefined &&
    (typeof r.limit !== "number" || !Number.isFinite(r.limit) || r.limit <= 0)
  ) {
    return false;
  }
  return true;
}

function clampLimit(n: number | undefined): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return ARTICLE_HARD_CAP;
  return Math.max(1, Math.min(ARTICLE_HARD_CAP, Math.round(n)));
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function summarizeSchedules(raw: unknown): AutonomousScheduleSummary[] {
  if (!Array.isArray(raw)) return [];
  const out: AutonomousScheduleSummary[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name : "";
    const niche = typeof r.niche === "string" ? r.niche : "";
    // Cadence may be encoded under a few field names depending on schema
    // version; try the common ones.
    let cadence = "";
    if (typeof r.cadence === "string") cadence = r.cadence;
    else if (typeof r.frequency === "string") cadence = r.frequency;
    else if (typeof r.schedule === "string") cadence = r.schedule;
    else if (typeof r.cron === "string") cadence = r.cron;
    out.push({ name, niche, cadence });
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

  const userId = parsed.userId;
  const limit = clampLimit(parsed.limit);

  const sb = getAdminClient();

  const [settingsRes, articlesRes] = await Promise.all([
    sb
      .from("user_settings")
      .select("niche, autopilot_niche, autonomous_schedules")
      .eq("user_id", userId)
      .maybeSingle(),
    sb
      .from("articles")
      .select("title, focus_keyword, topic, keywords")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  if (settingsRes.error) {
    return Response.json(
      { error: "settings_query_failed", detail: settingsRes.error.message },
      { status: 500 },
    );
  }
  if (articlesRes.error) {
    return Response.json(
      { error: "articles_query_failed", detail: articlesRes.error.message },
      { status: 500 },
    );
  }

  const settings = (settingsRes.data ?? null) as SettingsRow | null;
  const articleRows = (articlesRes.data ?? []) as ArticleRow[];

  const articles: ArticleSummary[] = articleRows.map((a) => ({
    title: (a.title ?? "").toString(),
    focusKeyword: (a.focus_keyword ?? "").toString(),
    topic: (a.topic ?? "").toString(),
    keywords: asStringArray(a.keywords),
  }));

  return Response.json({
    userId,
    niche: settings?.niche ?? null,
    autopilotNiche: settings?.autopilot_niche ?? null,
    autonomousSchedules: summarizeSchedules(settings?.autonomous_schedules),
    articles,
  });
}
