"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ScheduleRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/app/automate");
  }, [router]);
  return null;
}
