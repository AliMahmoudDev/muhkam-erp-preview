"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const progressVariants = cva("erp-progress-root", {
  variants: {
    size: {
      xs: "erp-progress-xs",
      sm: "erp-progress-sm",
      md: "erp-progress-md",
      lg: "erp-progress-lg",
    },
    intent: {
      default:  "",
      positive: "erp-progress-positive",
      negative: "erp-progress-negative",
      critical: "erp-progress-critical",
    },
  },
  defaultVariants: {
    size:   "md",
    intent: "default",
  },
})

export interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>,
    VariantProps<typeof progressVariants> {
  value?: number
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value = 0, size, intent, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(progressVariants({ size, intent }), className)}
    value={value}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="erp-progress-indicator"
      style={{ transform: `translateX(${100 - (value ?? 0)}%)` }}
    />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
