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
};
