import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: settings } = await supabase
    .from("user_settings")
    .select("wp_blogs, site_name, domain")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({
    blogs: settings?.wp_blogs ?? [],
    siteName: settings?.site_name ?? "",
    domain: settings?.domain ?? "",
  });
}
