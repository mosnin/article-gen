import { decryptCredential } from "@/lib/wp-crypto";
import type { MediumAccount } from "@/lib/publish-platforms";
import { logPublishEvent } from "@/lib/publish-log";
import { logger } from "@/lib/logger";
import type { MediumPublishOptions, PublishHelperArgs, PublishResult } from "./index";

interface MediumMeResponse {
  data?: { id?: string };
}

interface MediumPostResponse {
  data?: { id?: string; url?: string };
}

export async function publishToMedium(
  args: PublishHelperArgs,
  options: MediumPublishOptions = {},
): Promise<PublishResult> {
  const { admin, userId, articleId, platformAccountId } = args;
  const { tags, status, canonicalUrl } = options;

  try {
    const { data: settings } = await admin
      .from("user_settings")
      .select("medium_accounts")
      .eq("user_id", userId)
      .single();

    const accounts = (settings?.medium_accounts as MediumAccount[] | undefined) ?? [];
    const account = platformAccountId
      ? accounts.find((a) => a.id === platformAccountId)
      : accounts[0];

    if (!account?.integrationToken) {
      return {
        success: false,
        platform: "medium",
        error: "No Medium account connected. Add one in Settings.",
      };
    }

    const { data: article } = await admin
      .from("articles")
      .select("*")
      .eq("id", articleId)
      .eq("user_id", userId)
      .single();

    if (!article) {
      return {
        success: false,
        platform: "medium",
        accountName: account.name,
        error: "Article not found",
      };
    }

    const token = decryptCredential(account.integrationToken);

    const meRes = await fetch("https://api.medium.com/v1/me", {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });

    if (!meRes.ok) {
      if (meRes.status === 401) {
        return {
          success: false,
          platform: "medium",
          accountName: account.name,
          error: "Medium authentication failed. Check your integration token in Settings.",
        };
      }
      return {
        success: false,
        platform: "medium",
        accountName: account.name,
        error: `Medium API error (${meRes.status})`,
      };
    }

    const meData = (await meRes.json()) as MediumMeResponse;
    const mediumUserId = meData.data?.id;
    if (!mediumUserId) {
      return {
        success: false,
        platform: "medium",
        accountName: account.name,
        error: "Could not retrieve Medium user ID.",
      };
    }

    // Medium accepts markdown directly
    const postPayload: Record<string, unknown> = {
      title: article.title || article.topic,
      contentFormat: "markdown",
      content: article.article_markdown || "",
      publishStatus: status ?? "draft",
      tags: (tags ?? []).slice(0, 5), // Medium allows up to 5 tags
    };

    if (canonicalUrl) {
      postPayload.canonicalUrl = canonicalUrl;
    }

    const postRes = await fetch(
      `https://api.medium.com/v1/users/${mediumUserId}/posts`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(postPayload),
      },
    );

    if (!postRes.ok) {
      const data = (await postRes.json().catch(() => ({}))) as {
        errors?: Array<{ message?: string }>;
        error?: string;
      };
      const errMsg =
        data.errors?.[0]?.message || data.error || `Medium error (${postRes.status})`;
      return {
        success: false,
        platform: "medium",
        accountName: account.name,
        error: errMsg,
      };
    }

    const result = (await postRes.json()) as MediumPostResponse;
    const post = result.data;
    if (!post?.id || !post.url) {
      return {
        success: false,
        platform: "medium",
        accountName: account.name,
        error: "Medium returned no post",
      };
    }

    await admin
      .from("articles")
      .update({
        posted: true,
        published_platform: "medium",
        updated_at: new Date().toISOString(),
      })
      .eq("id", articleId)
      .eq("user_id", userId);

    await logPublishEvent(admin, {
      userId,
      articleId,
      platform: "medium",
      accountName: account.name,
      postId: post.id,
      postUrl: post.url,
      editUrl: post.url,
    });

    return {
      success: true,
      platform: "medium",
      accountName: account.name,
      postId: post.id,
      postUrl: post.url,
      editUrl: post.url,
    };
  } catch (error: unknown) {
    logger.error("Failed to publish to Medium", error);
    return {
      success: false,
      platform: "medium",
      error: "Failed to publish to Medium",
    };
  }
}
