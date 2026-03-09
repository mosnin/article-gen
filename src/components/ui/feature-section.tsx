"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { FileText, Globe, PenSquare, Sparkles, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const articleForms = [
  {
    title: "SaaS Pricing Psychology in 2026",
    subtitle: "By Maya Chen · growthlab.co",
    icon: <Sparkles className="h-4 w-4" />,
    image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&q=80",
  },
  {
    title: "Local SEO Checklist for Dental Clinics",
    subtitle: "By Ryan Patel · localrank.blog",
    icon: <Globe className="h-4 w-4" />,
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=80&q=80",
  },
  {
    title: "How to Repurpose Webinars Into 10 Posts",
    subtitle: "By Sofia Vale · contentorbit.io",
    icon: <FileText className="h-4 w-4" />,
    image:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=80&q=80",
  },
  {
    title: "B2B Newsletter Hooks That Lift Opens",
    subtitle: "By Omar Lewis · inboxcraft.net",
    icon: <PenSquare className="h-4 w-4" />,
    image:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&q=80",
  },
  {
    title: "Affiliate Blog Brief: Outdoor Gear",
    subtitle: "By Nina Romero · trailcopy.com",
    icon: <UserRound className="h-4 w-4" />,
    image:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=80&q=80",
  },
];

export default function FeatureSection() {
  return (
    <section className="relative w-full px-6 pb-24 text-[color:var(--foreground)]">
      <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-12 md:grid-cols-2">
        <div className="relative w-full max-w-md">
          <Card className="overflow-hidden border-[color:var(--card-border)] bg-[color:var(--card)]/70 backdrop-blur-md shadow-xl">
            <CardContent className="relative h-[330px] overflow-hidden p-0">
              <div className="relative h-full overflow-hidden">
                <motion.div
                  className="absolute flex w-full flex-col gap-0"
                  animate={{ y: ["0%", "-50%"] }}
                  transition={{ repeat: Infinity, repeatType: "loop", duration: 15, ease: "linear" }}
                >
                  {[...articleForms, ...articleForms].map((task, i) => (
                    <div
                      key={`${task.title}-${i}`}
                      className="relative flex items-center gap-3 border-b border-[color:var(--card-border)]/70 px-4 py-3"
                    >
                      <img
                        src={task.image}
                        alt={task.subtitle}
                        className="h-10 w-10 rounded-xl object-cover"
                      />
                      <div className="flex flex-1 items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{task.title}</p>
                          <p className="text-xs text-[color:var(--muted)]">{task.subtitle}</p>
                        </div>
                        <span className="text-[color:var(--muted)]">{task.icon}</span>
                      </div>
                    </div>
                  ))}
                </motion.div>

                <div className="pointer-events-none absolute left-0 top-0 h-12 w-full bg-gradient-to-b from-[color:var(--card)] via-[color:var(--card)]/70 to-transparent" />
                <div className="pointer-events-none absolute bottom-0 left-0 h-12 w-full bg-gradient-to-t from-[color:var(--card)] via-[color:var(--card)]/70 to-transparent" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Badge variant="secondary" className="px-3 py-1 text-sm">
            Article Workflow Automation
          </Badge>
          <h3 className="text-xl font-normal leading-relaxed lg:text-2xl">
            Generate article forms and briefs on autopilot.
            <span className="text-base text-[color:var(--muted)] lg:text-xl">
              {" "}
              We structure every brief with author context, blog destination, SEO angle, and formatting guidance so your team can go from idea to publish-ready draft faster, with less manual busywork.
            </span>
          </h3>

          <div className="flex flex-wrap gap-3">
            <Badge className="px-4 py-2 text-sm">Briefs in seconds</Badge>
            <Badge className="px-4 py-2 text-sm">SEO-aware structure</Badge>
            <Badge className="px-4 py-2 text-sm">Team-ready handoff</Badge>
          </div>
        </div>
      </div>
    </section>
  );
}
