"use client";

import PublishPage from "@/app/app/publish/[id]/page";

export default function ArticleDetailPage(props: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  // Forward props verbatim — Next.js 15 may pass params as a Promise.
  // PublishPage internally calls useParams() so it reads the route id directly,
  // but we still pass props through for forward compatibility.
  return <PublishPage {...(props as Parameters<typeof PublishPage>[0])} />;
}
