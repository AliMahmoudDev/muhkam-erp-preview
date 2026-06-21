import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const spinnerVariants = cva("erp-spinner", {
  variants: {
    size: {
      xs: "erp-spinner-xs",
      sm: "erp-spinner-sm",
      md: "erp-spinner-md",
      lg: "erp-spinner-lg",
    },
    intent: {
      default:  "",
      accent:   "erp-spinner-accent",
      muted:    "erp-spinner-muted",
      inverted: "erp-spinner-inverted",
    },
  },
  defaultVariants: {
    size:   "md",
    intent: "default",
  },
})

export interface SpinnerProps
  extends React.SVGAttributes<SVGElement>,
    VariantProps<typeof spinnerVariants> {
  label?: string
}

const Spinner = React.forwardRef<SVGSVGElement, SpinnerProps>(
  ({ className, size, intent, label = "جاري التحميل", ...props }, ref) => (
    <svg
      ref={ref}
      role="status"
      aria-label={label}
      viewBox="0 0 24 24"
      fill="none"
      className={cn(spinnerVariants({ size, intent }), className)}
      {...props}
    >
      <circle
        className="erp-spinner-track"
        cx="12" cy="12" r="10"
        strokeWidth="2.5"
        stroke="currentColor"
      />
      <path
        className="erp-spinner-arc"
        d="M12 2a10 10 0 0 1 10 10"
        strokeWidth="2.5"
        strokeLinecap="round"
        stroke="currentColor"
      />
    </svg>
  )
)
Spinner.displayName = "Spinner"

export { Spinner }
