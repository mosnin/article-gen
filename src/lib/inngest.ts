import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "article-gen",
  name: "Article Gen",
});

export type Events = {
  "article/embedding.store": {
    data: {
      userId: string;
      articleId: string;
      title: string;
      keyword: string;
      content: string;
    };
  };
  "autopilot/plan.generate": {
    data: {
      userId: string;
      niche: string;
      targetAudience?: string;
      count: number;
    };
  };
  "autopilot/article.generate": {
    data: {
      userId: string;
      slotId: string;
      keyword: string;
      topic: string;
      contentType: string;
    };
  };
  "agent/article.generate": {
    data: {
      runId?: string;
      userId: string;
      kind?:
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
        | "research_and_write";
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
    };
  };
};
