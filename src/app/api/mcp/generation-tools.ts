import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import OpenAI from "openai";
import { defineTool } from "@/lib/mcp/context";
import type { McpAuth } from "@/lib/mcp/auth";

/** Lightweight AI writing utilities. These call OpenAI directly (no agent
 *  run, no credit charge) and are gated behind the 'generate' scope. */
export function registerGenerationTools(server: McpServer, auth: McpAuth) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  defineTool(server, auth, {
    name: "generate_article_brief",
    description: "Generate a detailed SEO content brief for a keyword.",
    scope: "generate",
    schema: { keyword: z.string().min(1).max(200), niche: z.string().max(200).optional() },
    handler: async ({ keyword, niche }) => {
      const prompt = `Create a concise SEO content brief for keyword: "${keyword}"${niche ? ` in the ${niche} niche` : ""}.
Return JSON with: suggestedTitle, targetWordCount (number), mustIncludeTopics (array of 6 strings), questionsToAnswer (array of 5 strings), suggestedOutline (array of 8 heading strings).`;
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.5,
      });
      return { content: [{ type: "text", text: completion.choices[0].message.content ?? "{}" }] };
    },
  });

  defineTool(server, auth, {
    name: "generate_title_variations",
    description: "Generate 5 SEO-optimized title variations for a keyword.",
    scope: "generate",
    schema: { keyword: z.string().min(1).max(200), content_type: z.string().max(100).default("article") },
    handler: async ({ keyword, content_type }) => {
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: `Generate 5 compelling SEO titles for keyword "${keyword}" (${content_type}). Return JSON: {"titles": [...]}` }],
        response_format: { type: "json_object" },
        temperature: 0.8,
      });
      return { content: [{ type: "text", text: completion.choices[0].message.content ?? "{}" }] };
    },
  });

  defineTool(server, auth, {
    name: "generate_meta_description",
    description: "Generate an SEO meta description for an article.",
    scope: "generate",
    schema: { title: z.string().min(1).max(300), keyword: z.string().min(1).max(200), content_preview: z.string().max(2000).optional() },
    handler: async ({ title, keyword, content_preview }) => {
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: `Write a 150-160 char SEO meta description for: "${title}" (keyword: ${keyword})${content_preview ? `. Content preview: ${content_preview.slice(0, 200)}` : ""}. Return only the description text.` }],
        temperature: 0.5,
      });
      return { content: [{ type: "text", text: completion.choices[0].message.content ?? "" }] };
    },
  });

  defineTool(server, auth, {
    name: "suggest_internal_links",
    description: "Suggest internal linking opportunities between articles.",
    scope: "generate",
    schema: {
      source_content: z.string().min(1).max(20000),
      target_articles: z.array(z.object({ id: z.string(), title: z.string(), keyword: z.string() })).min(1).max(50),
    },
    handler: async ({ source_content, target_articles }) => {
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: `Analyze this article and suggest natural internal link placements for these articles:\n\nArticle (first 1000 chars): ${source_content.slice(0, 1000)}\n\nAvailable targets:\n${target_articles.map(a => `- ${a.title} (${a.keyword})`).join("\n")}\n\nReturn JSON: {"suggestions": [{"targetTitle": "...", "anchorText": "...", "placement": "suggested sentence context"}]}` }],
        response_format: { type: "json_object" },
        temperature: 0.4,
      });
      return { content: [{ type: "text", text: completion.choices[0].message.content ?? "{}" }] };
    },
  });
}
