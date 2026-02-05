import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 60;

const MODEL = "gpt-4.1-mini";

export async function POST(req: NextRequest) {
  try {
    const { topic, focusKeyword } = await req.json();

    if (!topic) {
      return NextResponse.json(
        { error: "Topic is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured. Please set the OPENAI_API_KEY environment variable in Vercel." },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });

    // Run context organization and research in parallel - they're independent
    const [step1, step2] = await Promise.all([
      openai.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are an expert content strategist and SEO specialist. Your job is to organize the context and structure for a comprehensive article.",
          },
          {
            role: "user",
            content: `Organize the context for a comprehensive, SEO-optimized article about: "${topic}"${focusKeyword ? `. The main focus keyword is: "${focusKeyword}"` : ""}.

Please provide:
1. The main theme and angle of the article
2. Target audience
3. Key points to cover (at least 8-10 subtopics)
4. The logical flow and structure
5. What questions readers might have
6. Suggested focus keyword if not provided
7. 5 high-intent related keywords

Format your response clearly with labeled sections.`,
          },
        ],
        temperature: 0.7,
      }),
      openai.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a research assistant. Provide factual, well-sourced information with real URLs to authoritative sources. Include statistics, expert opinions, and recent developments.",
          },
          {
            role: "user",
            content: `Research and provide approximately 1000 words of factual context about: "${topic}"

Include:
- Current statistics and data points
- Expert opinions and quotes
- Recent developments and trends
- Historical context where relevant
- At least 5 authoritative source URLs (from sites like .gov, .edu, major publications, industry leaders)

Format each fact with its source URL. Make sure all information is accurate and verifiable.`,
          },
        ],
        temperature: 0.5,
      }),
    ]);

    const articleContext = step1.choices[0].message.content || "";
    const researchContext = step2.choices[0].message.content || "";

    return NextResponse.json({ articleContext, researchContext });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";

    if (message.includes("API key") || message.includes("auth")) {
      return NextResponse.json(
        { error: "Invalid API key. Please check your OpenAI API key." },
        { status: 401 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
