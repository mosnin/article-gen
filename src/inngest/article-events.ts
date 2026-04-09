import { inngest } from "@/lib/inngest";

export const onArticlePublished = inngest.createFunction(
  { id: "on-article-published" },
  { event: "article/published" },
  async ({ event, logger }) => {
    logger.info("on-article-published stub fired", { data: event.data });
    // TODO: implement post-publish actions
  }
);

export const weeklyContentReport = inngest.createFunction(
  { id: "weekly-content-report" },
  { cron: "0 9 * * 1" },
  async ({ logger }) => {
    logger.info("weekly-content-report stub fired");
    // TODO: implement weekly content report
  }
);
