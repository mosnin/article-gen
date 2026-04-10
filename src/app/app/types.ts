export interface ImagePrompt {
  type: string;
  prompt: string;
  altText: string;
}

export interface GeneratedImage {
  type: string;
  altText: string;
  storagePath: string | null;
  publicUrl: string | null;
  success: boolean;
}

export interface GenerationResult {
  title: string;
  metaDescription: string;
  slug: string;
  focusKeyword: string;
  keywords: string[];
  article: string;
  imagePrompts: ImagePrompt[];
  schema: string;
  generatedImages?: GeneratedImage[];
}

export interface ArticleSession {
  id: string;
  topic: string;
  focusKeyword: string;
  wpBlogId?: string | null;
  loading: boolean;
  queued: boolean;
  error: string;
  result: GenerationResult | null;
  currentStep: number;
  quality: "standard" | "premium";
  posted: boolean;
  imageProgress?: string;
}

export interface BatchQueueItem {
  id: string;
  topic: string;
  focusKeyword: string | undefined;
  quality: "standard" | "premium";
  withImages: boolean;
  blogId?: string;
  tone?: string;
  targetAudience?: string;
}

export interface WpBlog {
  id: string;
  name: string;
  url: string;
  username: string;
  appPassword: string;
  authorName?: string;
  authorAbout?: string;
}

export interface AdvancedSettings {
  domain: string;
  siteName: string;
  siteAbout: string;
  authorName: string;
  authorAbout: string;
  wpUrl: string;
  wpUsername: string;
  wpAppPassword: string;
}

export interface ClusterArticle {
  id: string;
  concept: string;
  keyword: string;
  relation: string;
  session: ArticleSession | null;
}

export interface TopicCluster {
  id: string;
  pillarTopic: string;
  pillarKeyword: string;
  wpBlogId?: string | null;
  pillarSession: ArticleSession | null;
  clusterArticles: ClusterArticle[];
  quality: "standard" | "premium";
  generating: boolean;
  generationPhase: "idle" | "planning" | "pillar" | "clusters" | "relinking" | "done";
  expanded: boolean;
}
