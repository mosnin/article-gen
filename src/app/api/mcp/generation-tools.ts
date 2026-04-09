import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import OpenAI from "openai";

export function registerGenerationTools(server: McpServer) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // generate_article_brief: given a keyword, returns a content brief
  server.tool("generate_article_brief",
    "Generate a detailed SEO content brief for a keyword",
    { keyword: z.string(), niche: z.string().optional() },
    async ({ keyword, niche }) => {
      const prompt = `Create a concise SEO content brief for keyword: "${keyword}"${niche ? ` in the ${niche} niche` : ""}.
Return JSON with: suggestedTitle, targetWordCount (number), mustIncludeTopics (array of 6 strings), questionsToAnswer (array of 5 strings), suggestedOutline (array of 8 heading strings).`;
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.5,
      });
      return { content: [{ type: "text", text: completion.choices[0].message.content ?? "{}" }] };
    }
  );

  // generate_title_variations: generate 5 SEO title variations
  server.tool("generate_title_variations",
    "Generate 5 SEO-optimized title variations for a keyword",
    { keyword: z.string(), contentType: z.string().default("article") },
    async ({ keyword, contentType }) => {
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: `Generate 5 compelling SEO titles for keyword "${keyword}" (${contentType}). Return JSON: {"titles": [...]}` }],
        response_format: { type: "json_object" },
        temperature: 0.8,
      });
      return { content: [{ type: "text", text: completion.choices[0].message.content ?? "{}" }] };
    }
  );

  // generate_meta_description
  server.tool("generate_meta_description",
    "Generate an SEO meta description for an article",
    { title: z.string(), keyword: z.string(), content_preview: z.string().optional() },
    async ({ title, keyword, content_preview }) => {
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: `Write a 150-160 char SEO meta description for: "${title}" (keyword: ${keyword})${content_preview ? `. Content preview: ${content_preview.slice(0, 200)}` : ""}. Return only the description text.` }],
        temperature: 0.5,
      });
      return { content: [{ type: "text", text: completion.choices[0].message.content ?? "" }] };
    }
  );

  // suggest_internal_links: given article content and list of existing articles, suggest internal links
  server.tool("suggest_internal_links",
    "Suggest internal linking opportunities between articles",
    { source_content: z.string(), target_articles: z.array(z.object({ id: z.string(), title: z.string(), keyword: z.string() })) },
    async ({ source_content, target_articles }) => {
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: `Analyze this article and suggest natural internal link placements for these articles:\n\nArticle (first 1000 chars): ${source_content.slice(0, 1000)}\n\nAvailable targets:\n${target_articles.map(a => `- ${a.title} (${a.keyword})`).join("\n")}\n\nReturn JSON: {"suggestions": [{"targetTitle": "...", "anchorText": "...", "placement": "suggested sentence context"}]}` }],
        response_format: { type: "json_object" },
        temperature: 0.4,
      });
      return { content: [{ type: "text", text: completion.choices[0].message.content ?? "{}" }] };
    }
  );
}
