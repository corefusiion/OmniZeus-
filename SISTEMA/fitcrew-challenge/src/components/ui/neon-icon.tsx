import { forwardRef, type ComponentPropsWithoutRef } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type NeonIconProps = ComponentPropsWithoutRef<"span"> & {
  icon: LucideIcon;
  size?: "sm" | "md" | "lg";
  /** Enable ambient float + glow pulse (disabled by default on touch/mobile for perf). */
  animated?: boolean;
  /** Ms offset for staggered animations. */
  delay?: number;
  strokeWidth?: number;
};

const sizeMap = {
  sm: { box: "size-8", icon: "size-3.5", ring: "ring-[3px]" },
  md: { box: "size-10", icon: "size-4", ring: "ring-4" },
  lg: { box: "size-12", icon: "size-5", ring: "ring-4" },
} as const;

/**
 * NeonIcon — circular badge with a soft orange glow and floating micro-motion.
 * GPU-only (transform/opacity), auto-disables on reduced motion.
 */
export const NeonIcon = forwardRef<HTMLSpanElement, NeonIconProps>(
  ({ icon: Icon, size = "md", animated = true, delay = 0, strokeWidth = 2.4, className, style, ...rest }, ref) => {
    const s = sizeMap[size];
    return (
      <span
        ref={ref}
        className={cn(
          "neon-icon relative z-10 grid shrink-0 place-items-center rounded-full bg-background text-foreground ring-foreground shadow-lg",
          "transition-transform duration-300 will-change-transform",
          "group-hover:scale-[1.05]",
          s.box,
          s.ring,
          animated && "neon-icon--anim",
          className,
        )}
        style={{ animationDelay: `${delay}ms`, ...style }}
        {...rest}
      >
        {animated && (
          <span
            aria-hidden
            className="neon-icon__glow pointer-events-none absolute -inset-1.5 rounded-full"
            style={{ animationDelay: `${delay}ms` }}
          />
        )}
        <Icon className={cn("relative transition-transform duration-300 group-hover:scale-110", s.icon)} strokeWidth={strokeWidth} />
      </span>
    );
  },
);
NeonIcon.displayName = "NeonIcon";
