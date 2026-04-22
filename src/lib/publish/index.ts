import type { SupabaseClient } from "@supabase/supabase-js";

export type PublishPlatform = "wordpress" | "ghost" | "medium" | "shopify" | "devto";

export type PublishResult = {
  success: boolean;
  platform: PublishPlatform;
  accountName?: string;
  postId?: string;
  postUrl?: string;
  editUrl?: string;
  error?: string;
};

export type PublishHelperArgs = {
  admin: SupabaseClient;
  userId: string;
  articleId: string;
  platformAccountId: string;
};

// Per-platform option extensions — forwarded from the existing session-gated
// route shims (they accept these fields in their request body). The agent
// path does not pass options; defaults match the old route behaviour.
export type WordpressPublishOptions = {
  categoryIds?: number[];
  status?: string;
  includeImages?: boolean;
};

export type GhostPublishOptions = {
  tags?: string[];
  status?: "draft" | "published";
};

export type MediumPublishOptions = {
  tags?: string[];
  status?: "draft" | "public" | "unlisted";
  canonicalUrl?: string;
};

export type ShopifyPublishOptions = {
  tags?: string[];
  status?: "draft" | "publish";
};

export type DevtoPublishOptions = {
  tags?: string[];
  published?: boolean;
  canonicalUrl?: string;
};

// Re-export per-platform helpers:
export { publishToWordpress } from "./wordpress";
export { publishToGhost } from "./ghost";
export { publishToMedium } from "./medium";
export { publishToShopify } from "./shopify";
export { publishToDevto } from "./devto";
