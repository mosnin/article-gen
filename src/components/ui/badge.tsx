import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-[var(--accent-light)] text-[var(--accent)] border border-blue-200 dark:border-blue-800",
        success: "bg-[var(--success-light)] text-[var(--success)] border border-green-200 dark:border-green-800",
        warning: "bg-[var(--warning-light)] text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800",
        error: "bg-[var(--error-light)] text-[var(--error)] border border-red-200 dark:border-red-800",
        neutral: "bg-[var(--surface-sunken)] text-[var(--text-secondary)] border border-[var(--border-default)]",
        outline: "border border-[var(--border-default)] text-[var(--text-secondary)] bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
