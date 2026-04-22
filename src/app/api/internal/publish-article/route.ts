import { requireInternalAuth } from "@/lib/agent-auth";
import { getAdminClient } from "@/lib/supabase-admin";
import {
  publishToDevto,
  publishToGhost,
  publishToMedium,
  publishToShopify,
  publishToWordpress,
  type PublishPlatform,
  type PublishResult,
} from "@/lib/publish";

export const runtime = "nodejs";

type PlatformTarget = { kind: PublishPlatform; id: string };

type DispatchResult = PublishResult & { accountId: string };

export async function POST(req: Request) {
  const auth = await requireInternalAuth(req);
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { userId: string; articleId: string; platforms: PlatformTarget[] };
  try {
    body = JSON.parse(auth.rawBody);
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.userId || !body.articleId || !Array.isArray(body.platforms)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const admin = getAdminClient();
  const { userId, articleId } = body;

  const results: DispatchResult[] = await Promise.all(
    body.platforms.map(async (p): Promise<DispatchResult> => {
      const args = {
        admin,
        userId,
        articleId,
        platformAccountId: p.id,
      };
      try {
        switch (p.kind) {
          case "wordpress": {
            const r = await publishToWordpress(args);
            return { ...r, accountId: p.id };
          }
          case "ghost": {
            const r = await publishToGhost(args);
            return { ...r, accountId: p.id };
          }
          case "medium": {
            const r = await publishToMedium(args);
            return { ...r, accountId: p.id };
          }
          case "shopify": {
            const r = await publishToShopify(args);
            return { ...r, accountId: p.id };
          }
          case "devto": {
            const r = await publishToDevto(args);
            return { ...r, accountId: p.id };
          }
          default: {
            const kind: string = p.kind;
            return {
              success: false,
              platform: kind as PublishPlatform,
              accountId: p.id,
              error: "unsupported_platform",
            };
          }
        }
      } catch (err) {
        return {
          success: false,
          platform: p.kind,
          accountId: p.id,
          error: err instanceof Error ? err.message : "publish_failed",
        };
      }
    }),
  );

  return Response.json({ results });
}
