import { signBody } from "@/lib/agent-auth";

export type ModalTriggerPayload = {
  runId: string;
  userId: string;
  kind:
    | "article"
    | "autopilot"
    | "cluster"
    | "research_only"
    | "refresh"
    | "audit"
    | "cluster_plan"
    | "social_snippet"
    | "keyword_harvest"
    | "topic_research"
    | "research_and_write"
    | "competitor_monitor"
    | "internal_link_optimize"
    | "schema_doctor"
    | "content_brief"
    | "seasonal_calendar"
    | "cannibalization_resolve"
    | "image_optimize"
    | "performance_coach"
    | "newsletter_digest"
    | "social_publish"
    | "sponsorship_fit"
    | "cost_optimize"
    | "prompt_drift_detect"
    | "user_segment";
  topic: string;
  focusKeyword?: string;
  tone?: string;
  targetAudience?: string;
  quality?: "standard" | "premium";
  options?: Record<string, unknown>;
  autopilotSlotId?: string;
  articleId?: string;
  articleIds?: string[];
  clusterId?: string;
  clusterPillarTopic?: string;
  socialPlatforms?: string[];
  gscSiteUrl?: string;
  competitorIds?: string[];
  contentBriefId?: string;
  newsletterPeriodDays?: number;
  snippetIds?: string[];
  costPeriodDays?: number;
  driftScope?: "global" | "user";
  webhookUrl?: string;       // filled server-side if omitted
  internalApiBase?: string;  // filled server-side if omitted
};

export type ModalTriggerResult = {
  modalCallId: string;
  runId: string;
};

export async function triggerAgentRun(payload: ModalTriggerPayload): Promise<ModalTriggerResult> {
  const url = process.env.MODAL_AGENT_TRIGGER_URL;
  const token = process.env.MODAL_AGENT_TOKEN;
  if (!url) throw new Error("MODAL_AGENT_TRIGGER_URL not configured");
  if (!token) throw new Error("MODAL_AGENT_TOKEN not configured");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const body = JSON.stringify({
    ...payload,
    webhookUrl: payload.webhookUrl || (appUrl ? `${appUrl}/api/agent/webhook` : undefined),
    internalApiBase: payload.internalApiBase || (appUrl ? `${appUrl}/api/internal` : undefined),
  });
  const sig = signBody(body, token);

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-signature": sig,
    },
    body,
    cache: "no-store",
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Modal trigger failed (${resp.status}): ${text}`);
  }
  return (await resp.json()) as ModalTriggerResult;
}
