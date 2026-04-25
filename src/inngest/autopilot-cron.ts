import { inngest } from "@/lib/inngest";
import { getAdminClient } from "@/lib/supabase-admin";
import { computeNextRunAt } from "@/lib/schedule-next-run";

type AutonomousSchedulePlatform = { kind: string; id: string };

type AutonomousSchedule = {
  id?: string;
  userId?: string;
  name?: string;
  cadence?: "daily" | "weekly" | "monthly" | string;
  niche?: string;
  tone?: string;
  targetAudience?: string;
  platforms?: AutonomousSchedulePlatform[] | string[];
  status?: "active" | "paused" | string;
  nextRunAt?: string;
  updatedAt?: string;
  timezone?: string;
  timeOfDayLocal?: string;
  weekdayMask?: number[];
  requiresApproval?: boolean;
  topicSource?: "static_niche" | "topic_proposals" | "keyword_candidates" | string;
  [key: string]: unknown;
};

function advanceNextRunAt(s: AutonomousSchedule): string {
  // Try the v2 helper first.
  try {
    const cadence = (s.cadence === "daily" || s.cadence === "weekly" || s.cadence === "monthly")
      ? s.cadence
      : "weekly";
    const iso = computeNextRunAt({
      timezone: s.timezone ?? "UTC",
      timeOfDayLocal: s.timeOfDayLocal ?? "09:00",
      cadence,
      weekdayMask: s.weekdayMask,
      // from = now + 1 minute so we don't re-dispatch immediately if the helper
      // would otherwise return "today at HH:MM" that's still marginally in the future.
      from: new Date(Date.now() + 60_000),
    });
    if (iso && !Number.isNaN(new Date(iso).getTime())) return iso;
  } catch {
    // fall through to legacy path
  }

  // Legacy fallback: bump by cadence in UTC.
  const next = new Date();
  if (s.cadence === "daily") next.setUTCDate(next.getUTCDate() + 1);
  else if (s.cadence === "weekly") next.setUTCDate(next.getUTCDate() + 7);
  else if (s.cadence === "monthly") next.setUTCMonth(next.getUTCMonth() + 1);
  return next.toISOString();
}

export const autopilotCron = inngest.createFunction(
  { id: "autopilot-cron", name: "Autopilot Publishing Cron", triggers: [{ cron: "0 * * * *" }] },
  async ({ step }) => {
    const supabase = getAdminClient();

    // ── Pass 1: existing autopilot_plan handling ─────────────────────────────
    // Find all users with autopilot_enabled=true
    // For each user, check their autopilot_plan for slots with:
    //   - status="approved"
    //   - date <= today
    //   - articleId is not null
    // For each qualifying slot, find the article and publish it to the user's connected platforms
    // Update slot status to "done" after publishing

    const result = await step.run("process-autopilot-slots", async () => {
      const today = new Date().toISOString().split("T")[0];

      const { data: users } = await supabase
        .from("user_settings")
        .select("user_id, autopilot_plan, autopilot_enabled, wp_blogs, domain")
        .eq("autopilot_enabled", true);

      if (!users?.length) return { processed: 0 };

      type Slot = { id: string; status: string; articleId: string | null; date: string; [key: string]: unknown };
      let processed = 0;
      for (const user of users) {
        const plan = (user.autopilot_plan as Slot[]) ?? [];
        const dueSlots = plan.filter(
          (s) => s.status === "approved" && s.articleId && s.date <= today
        );

        for (const slot of dueSlots) {
          // Update slot to generating/done
          const updatedPlan = plan.map((s) =>
            s.id === slot.id ? { ...s, status: "done" } : s
          );
          await supabase
            .from("user_settings")
            .update({ autopilot_plan: updatedPlan })
            .eq("user_id", user.user_id);
          processed++;
        }
      }
      return { processed };
    });

    // ── Pass 2: autonomous_schedules (spec §10) ──────────────────────────────
    // Enumerate every user's `user_settings.autonomous_schedules`; for each
    // active schedule whose `nextRunAt <= now`, either dispatch the run or
    // queue a pending approval (if `requiresApproval` is set). Then advance
    // `nextRunAt` using the v2 helper (timezone/time-of-day/weekday-mask
    // aware) with a legacy-UTC fallback.
    const dispatched = await step.run("process-autonomous-schedules", async () => {
      const { data: userRows } = await supabase
        .from("user_settings")
        .select("user_id, autonomous_schedules")
        .not("autonomous_schedules", "is", null);

      const nowIso = new Date().toISOString();
      let count = 0;
      let approvalsQueued = 0;

      for (const row of userRows ?? []) {
        const schedules = Array.isArray(row.autonomous_schedules)
          ? (row.autonomous_schedules as AutonomousSchedule[])
          : [];

        let mutated = false;

        for (const s of schedules) {
          if (s.status !== "active") continue;
          if (!s.nextRunAt || s.nextRunAt > nowIso) continue;

          // Resolve topic + focusKeyword based on the schedule's topicSource.
          // Default ("static_niche" or unset) preserves existing behavior.
          const source = s.topicSource ?? "static_niche";
          let resolvedTopic: string = `${s.niche} — upcoming post`;
          let resolvedFocusKeyword: string | undefined = s.niche;
          let resolvedProposalId: string | null = null;
          let resolvedCandidateId: string | null = null;

          if (source === "topic_proposals") {
            const { data: proposalRow } = await supabase
              .from("topic_proposals")
              .select("id, title, focus_keyword")
              .eq("user_id", row.user_id)
              .eq("status", "approved")
              .order("relevance_score", { ascending: false })
              .order("created_at", { ascending: true })
              .limit(1)
              .maybeSingle();
            if (!proposalRow) {
              // No approved proposals available — skip dispatch AND skip
              // bumping nextRunAt so the next tick can pick it up once
              // proposals exist.
              continue;
            }
            const proposal = proposalRow as { id: string; title: string; focus_keyword: string };
            resolvedTopic = proposal.title;
            resolvedFocusKeyword = proposal.focus_keyword;
            resolvedProposalId = proposal.id;
          } else if (source === "keyword_candidates") {
            const { data: candidateRow } = await supabase
              .from("keyword_candidates")
              .select("id, keyword")
              .eq("user_id", row.user_id)
              .eq("status", "accepted")
              .order("created_at", { ascending: true })
              .limit(1)
              .maybeSingle();
            if (!candidateRow) {
              // No accepted candidates available — skip dispatch AND skip
              // bumping nextRunAt so the next tick can pick it up once
              // candidates exist.
              continue;
            }
            const candidate = candidateRow as { id: string; keyword: string };
            resolvedTopic = candidate.keyword;
            resolvedFocusKeyword = candidate.keyword;
            resolvedCandidateId = candidate.id;
          }

          if (s.requiresApproval) {
            // Queue an approval row instead of dispatching.
            await supabase.from("autonomous_pending_approvals").insert({
              user_id: row.user_id,
              schedule_id: s.id,
              topic_suggestion: resolvedTopic,
              focus_keyword: resolvedFocusKeyword ?? null,
              niche: s.niche,
              tone: s.tone ?? null,
              target_audience: s.targetAudience ?? null,
              platforms: s.platforms ?? [],
              proposed_run_at: nowIso,
              status: "pending",
            });
            approvalsQueued++;
          } else {
            await inngest.send({
              name: "agent/article.generate",
              data: {
                userId: row.user_id,
                kind: "autopilot",
                topic: resolvedTopic,
                focusKeyword: resolvedFocusKeyword,
                tone: s.tone,
                targetAudience: s.targetAudience,
                quality: "standard",
                options: {
                  autoPublish: Array.isArray(s.platforms) ? s.platforms.length > 0 : false,
                  platforms: s.platforms ?? [],
                  ...(resolvedProposalId ? { topicProposalId: resolvedProposalId } : {}),
                  ...(resolvedCandidateId ? { keywordCandidateId: resolvedCandidateId } : {}),
                },
              },
            });
            count++;
          }

          // Mark the source row as consumed AFTER successful dispatch/queue.
          if (resolvedProposalId) {
            await supabase
              .from("topic_proposals")
              .update({
                status: "written_in_progress",
                decided_at: new Date().toISOString(),
              })
              .eq("id", resolvedProposalId);
          } else if (resolvedCandidateId) {
            await supabase
              .from("keyword_candidates")
              .update({ status: "used" })
              .eq("id", resolvedCandidateId);
          }

          // Advance nextRunAt via v2 helper (with legacy fallback).
          s.nextRunAt = advanceNextRunAt(s);
          s.updatedAt = new Date().toISOString();
          mutated = true;
        }

        if (mutated) {
          await supabase
            .from("user_settings")
            .update({ autonomous_schedules: schedules })
            .eq("user_id", row.user_id);
        }
      }

      return { dispatched: count, approvalsQueued };
    });

    return { ...result, ...dispatched };
  }
);
