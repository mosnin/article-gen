import * as React from "react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface HeroSectionProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  animatedTexts: string[];
  subtitle: string;
  infoBadgeText: string;
  ctaButtonText: string;
  socialProofText: string;
  ctaButtonProps?: React.ComponentProps<typeof Button>;
  avatars: {
    src: string;
    alt: string;
    fallback: string;
  }[];
}

const HeroSection = React.forwardRef<HTMLDivElement, HeroSectionProps>(
  (
    {
      className,
      title,
      animatedTexts,
      subtitle,
      infoBadgeText,
      ctaButtonText,
      socialProofText,
      avatars,
      ctaButtonProps,
      ...props
    },
    ref
  ) => {
    const [textIndex, setTextIndex] = React.useState(0);
    const [displayText, setDisplayText] = React.useState("");
    const [isDeleting, setIsDeleting] = React.useState(false);

    React.useEffect(() => {
      const fullText = animatedTexts[textIndex];

      const handleTyping = () => {
        if (isDeleting) {
          setDisplayText((prev) => prev.substring(0, prev.length - 1));
        } else {
          setDisplayText((prev) => fullText.substring(0, prev.length + 1));
        }
      };

      const typingSpeed = isDeleting ? 75 : 130;
      const typeInterval = setInterval(handleTyping, typingSpeed);

      if (!isDeleting && displayText === fullText) {
        setTimeout(() => setIsDeleting(true), 1800);
      } else if (isDeleting && displayText === "") {
        setIsDeleting(false);
        setTextIndex((prev) => (prev + 1) % animatedTexts.length);
      }

      return () => clearInterval(typeInterval);
    }, [displayText, isDeleting, textIndex, animatedTexts]);

    return (
      <section
        className={cn(
          "container mx-auto flex flex-col items-center justify-center px-6 pb-24 pt-32 text-center",
          className
        )}
        ref={ref}
        {...props}
      >
        <div className="max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[color:var(--card-border)] px-4 py-1.5 text-xs font-medium text-[color:var(--muted)]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--success)]" />
            {infoBadgeText}
          </div>

          <h1
            className="text-5xl font-bold leading-tight tracking-tight md:text-7xl"
            style={{ letterSpacing: "-0.03em" }}
          >
            {title}
            <span className="relative mt-2 block w-fit">
              <span className="absolute inset-0 -z-10 -m-2">
                <span className="absolute inset-0 rounded-2xl border-2 border-dashed border-[color:var(--card-border)]"></span>
              </span>
              <span className="inline-block min-h-[1.2em] bg-gradient-to-br from-[color:var(--foreground)] to-[color:var(--muted)] bg-clip-text text-transparent">
                {displayText}
                <span className="animate-pulse text-[color:var(--foreground)]">|</span>
              </span>
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[color:var(--muted)] md:text-xl">
            {subtitle}
          </p>
        </div>

        <div className="mt-10 flex flex-col items-center gap-6">
          <Button
            size="lg"
            className="rounded-full px-8 py-6 text-base font-semibold text-white shadow-[0_4px_14px_rgba(0,0,0,0.15)]"
            {...ctaButtonProps}
          >
            {ctaButtonText}
          </Button>

          <div className="mt-1 flex items-center justify-center">
            <div className="flex -space-x-4">
              {avatars.map((avatar, index) => (
                <Avatar key={index} className="border-2 border-[color:var(--background)]">
                  <AvatarImage src={avatar.src} alt={avatar.alt} />
                  <AvatarFallback>{avatar.fallback}</AvatarFallback>
                </Avatar>
              ))}
            </div>
            <p className="ml-4 text-sm font-medium text-[color:var(--muted)]">{socialProofText}</p>
          </div>
        </div>
      </section>
    );
  }
);

HeroSection.displayName = "HeroSection";

export { HeroSection };
