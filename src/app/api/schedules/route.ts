import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { checkCredits } from "@/lib/credits";

// GET: List user's scheduled articles
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("scheduled_articles")
      .select("*, articles(title, posted)")
      .eq("user_id", user.id)
      .order("scheduled_for", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ schedules: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: Create a new scheduled article
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const {
      topic,
      focusKeyword,
      quality,
      generateImages,
      autoPublish,
      publishStatus,
      wpBlogId,
      categoryIds,
      scheduledFor,
      recurrence,
      recurrenceDay,
      articleId, // For scheduling existing articles (publish-only, skips generation)
    } = body;

    if (!scheduledFor) {
      return NextResponse.json({ error: "Scheduled time is required" }, { status: 400 });
    }

    // If scheduling an existing article, verify it exists and belongs to the user
    if (articleId) {
      const { data: article } = await supabase
        .from("articles")
        .select("id, topic, posted")
        .eq("id", articleId)
        .eq("user_id", user.id)
        .single();

      if (!article) {
        return NextResponse.json({ error: "Article not found" }, { status: 404 });
      }
      if (article.posted) {
        return NextResponse.json({ error: "Article is already posted" }, { status: 400 });
      }

      // Verify blog is connected for publish-only schedules
      if (!wpBlogId) {
        return NextResponse.json({ error: "A blog must be selected to schedule existing articles for publishing" }, { status: 400 });
      }

      const { data: settings } = await supabase
        .from("user_settings")
        .select("wp_blogs")
        .eq("user_id", user.id)
        .single();

      if (!settings?.wp_blogs || !Array.isArray(settings.wp_blogs)) {
        return NextResponse.json({ error: "No blogs connected. Add a blog in Settings first." }, { status: 400 });
      }
      const blog = (settings.wp_blogs as { id: string }[]).find((b) => b.id === wpBlogId);
      if (!blog) {
        return NextResponse.json({ error: "Selected blog not found in your settings." }, { status: 400 });
      }

      // No credits needed for publish-only schedules
      const { data, error } = await supabase
        .from("scheduled_articles")
        .insert({
          user_id: user.id,
          topic: article.topic || topic?.trim() || "Existing article",
          focus_keyword: focusKeyword?.trim() || "",
          quality: quality || "premium",
          generate_images: false,
          auto_publish: true,
          publish_status: publishStatus || "draft",
          wp_blog_id: wpBlogId,
          category_ids: categoryIds || [],
          scheduled_for: scheduledFor,
          recurrence: "one_time",
          recurrence_day: null,
          article_id: articleId,
        })
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ schedule: data });
    }

    if (!topic?.trim()) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    // Verify user has at least 1 credit (we don't deduct yet, just check)
    const creditCheck = await checkCredits(supabase, user.id);
    if (!creditCheck.allowed) {
      return NextResponse.json(
        { error: "Insufficient credits. You need at least 1 credit to schedule an article." },
        { status: 403 }
      );
    }

    // If auto-publish is on, verify they have a blog connected
    if (autoPublish && wpBlogId) {
      const { data: settings } = await supabase
        .from("user_settings")
        .select("wp_blogs")
        .eq("user_id", user.id)
        .single();

      if (!settings?.wp_blogs || !Array.isArray(settings.wp_blogs)) {
        return NextResponse.json({ error: "No blogs connected. Add a blog in Settings first." }, { status: 400 });
      }
      const blog = (settings.wp_blogs as { id: string }[]).find((b) => b.id === wpBlogId);
      if (!blog) {
        return NextResponse.json({ error: "Selected blog not found in your settings." }, { status: 400 });
      }
    }

    const { data, error } = await supabase
      .from("scheduled_articles")
      .insert({
        user_id: user.id,
        topic: topic.trim(),
        focus_keyword: focusKeyword?.trim() || "",
        quality: quality || "premium",
        generate_images: generateImages || false,
        auto_publish: autoPublish || false,
        publish_status: publishStatus || "draft",
        wp_blog_id: wpBlogId || null,
        category_ids: categoryIds || [],
        scheduled_for: scheduledFor,
        recurrence: recurrence || "one_time",
        recurrence_day: recurrenceDay ?? null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ schedule: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
