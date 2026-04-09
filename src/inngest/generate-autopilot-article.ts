import { inngest } from "@/lib/inngest";
import { getAdminClient } from "@/lib/supabase-admin";
import OpenAI from "openai";

const MODEL = "gpt-4.1-mini";

export const generateAutopilotArticle = inngest.createFunction(
  {
    id: "generate-autopilot-article",
    name: "Generate Autopilot Article",
    retries: 1,
    concurrency: { limit: 3 },
  },
  { event: "autopilot/article.generate" },
  async ({ event, step }) => {
    const { userId, slotId, keyword, topic, contentType } = event.data;
    const supabase = getAdminClient();

    // Step 1: fetch user settings
    const settings = await step.run("fetch-settings", async () => {
      const { data, error } = await supabase
        .from("user_settings")
        .select("site_name, site_about, author_name")
        .eq("user_id", userId)
        .single();

      if (error || !data) {
        throw new Error(`Failed to fetch user settings: ${error?.message ?? "No data"}`);
      }

      return {
        siteName: (data.site_name as string) ?? "",
        siteAbout: (data.site_about as string) ?? "",
        authorName: (data.author_name as string) ?? "",
      };
    });

    // Step 2: generate article content via OpenAI
    const article = await step.run("generate-article", async () => {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const prompt = `Write a comprehensive SEO article titled '${topic}' targeting keyword '${keyword}'. Content type: ${contentType}. Site: ${settings.siteName}. About: ${settings.siteAbout}. Word count: 1200-1500 words. Include H2/H3 headers, intro, body sections, conclusion.`;

      const completion = await openai.chat.completions.create({
        model: MODEL,
        max_tokens: 4000,
        messages: [
          {
            role: "system",
            content:
              "You are an expert SEO content writer. Write well-structured, engaging articles optimized for search engines.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const content = completion.choices[0]?.message?.content ?? "";
      const wordCount = content.split(/\s+/).filter(Boolean).length;

      return { content, wordCount };
    });

    // Step 3: save article to DB and update autopilot slot
    const savedArticleId = await step.run("save-article", async () => {
      // Insert article into articles table
      const { data: insertedArticle, error: insertError } = await supabase
        .from("articles")
        .insert({
          user_id: userId,
          title: topic,
          content: article.content,
          focus_keyword: keyword,
          topic,
          status: "draft",
          word_count: article.wordCount,
        })
        .select("id")
        .single();

      if (insertError || !insertedArticle) {
        throw new Error(`Failed to save article: ${insertError?.message ?? "No data"}`);
      }

      const articleId = insertedArticle.id as string;

      // Fetch current autopilot plan from user_settings
      const { data: settingsRow, error: fetchError } = await supabase
        .from("user_settings")
        .select("autopilot_plan")
        .eq("user_id", userId)
        .single();

      if (fetchError || !settingsRow) {
        throw new Error(`Failed to fetch autopilot plan: ${fetchError?.message ?? "No data"}`);
      }

      type AutopilotSlot = {
        id: string;
        articleId: string | null;
        status: string;
        [key: string]: unknown;
      };

      const plan = (settingsRow.autopilot_plan as AutopilotSlot[]) ?? [];
      const updatedPlan = plan.map((slot) =>
        slot.id === slotId
          ? { ...slot, articleId, status: "done" as const }
          : slot
      );

      // Update the plan in user_settings
      const { error: updateError } = await supabase
        .from("user_settings")
        .update({ autopilot_plan: updatedPlan })
        .eq("user_id", userId);

      if (updateError) {
        throw new Error(`Failed to update autopilot plan: ${updateError.message}`);
      }

      return articleId;
    });

    return { articleId: savedArticleId };
  }
);
