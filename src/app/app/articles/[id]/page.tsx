"use client";

import PublishPage from "@/app/app/publish/[id]/page";

// PublishPage takes no props — it reads the route id via useParams(),
// which resolves against this route's [id] segment just the same.
export default function ArticleDetailPage() {
  return <PublishPage />;
}
