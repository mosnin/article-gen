import type { SupabaseClient } from "@supabase/supabase-js";

interface PublishLogEntry {
  userId: string;
  articleId: string;
  platform: string;
  accountName?: string;
  postId?: string;
  postUrl?: string;
  editUrl?: string;
}

/** Fire-and-forget: insert a publish_logs row. Errors are logged but not thrown. */
export async function logPublishEvent(supabase: SupabaseClient, entry: PublishLogEntry): Promise<void> {
  const { error } = await supabase.from("publish_logs").insert({
    user_id: entry.userId,
    article_id: entry.articleId,
    platform: entry.platform,
    account_name: entry.accountName ?? null,
    post_id: entry.postId ? String(entry.postId) : null,
    post_url: entry.postUrl ?? null,
    edit_url: entry.editUrl ?? null,
  });
  if (error) {
    console.error("[publish-log] Failed to write publish log:", error.message);
  }
}
