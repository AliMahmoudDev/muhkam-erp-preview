import * as React from "react"
import { type LucideIcon } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const iconVariants = cva("erp-icon shrink-0", {
  variants: {
    size: {
      xs: "erp-icon-xs",
      sm: "erp-icon-sm",
      md: "erp-icon-md",
      lg: "erp-icon-lg",
      xl: "erp-icon-xl",
      "2xl": "erp-icon-2xl",
      "3xl": "erp-icon-3xl",
    },
    color: {
      default:    "text-[var(--color-text-secondary)]",
      primary:    "text-[var(--color-text-primary)]",
      accent:     "text-[var(--color-accent-text)]",
      muted:      "text-[var(--color-text-tertiary)]",
      positive:   "text-[var(--color-positive-text)]",
      negative:   "text-[var(--color-negative-text)]",
      critical:   "text-[var(--color-critical-text)]",
      informative:"text-[var(--color-informative-text)]",
    },
  },
  defaultVariants: {
    size:  "md",
    color: "default",
  },
})

export interface IconProps
  extends Omit<React.SVGAttributes<SVGElement>, "color">,
    VariantProps<typeof iconVariants> {
  icon: LucideIcon
  label?: string
}

const Icon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ icon: LucideIconComp, size, color, className, label, ...props }, ref) => (
    <LucideIconComp
      ref={ref}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      className={cn(iconVariants({ size, color }), className)}
      {...props}
    />
  )
)
Icon.displayName = "Icon"

export { Icon, iconVariants }
