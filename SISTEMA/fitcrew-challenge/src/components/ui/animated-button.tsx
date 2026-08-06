import { forwardRef } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AnimatedButtonProps = ButtonProps & {
  /** Adds the orange flame shadow (primary CTAs). */
  flame?: boolean;
};

/**
 * AnimatedButton — standard Button with consistent premium micro-interactions:
 * subtle lift on hover, press feedback on active, GPU-only transforms.
 */
export const AnimatedButton = forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  ({ className, flame, ...rest }, ref) => {
    return (
      <Button
        ref={ref}
        className={cn(
          "will-change-transform transition-all duration-200",
          "hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]",
          flame ? "shadow-flame hover:shadow-lg" : "hover:shadow-soft",
          className,
        )}
        {...rest}
      />
    );
  },
);
AnimatedButton.displayName = "AnimatedButton";
