import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "whitespace-nowrap inline-flex items-center gap-1 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-xs rounded-md px-2.5 py-0.5 text-xs border",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground rounded-md px-2.5 py-0.5 text-xs border",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow-xs rounded-md px-2.5 py-0.5 text-xs border",
        outline:
          "text-foreground border [border-color:var(--badge-outline)] rounded-md px-2.5 py-0.5 text-xs",

        /* ── Status pills — 24px height, 999px radius ── */
        paid:
          "erp-status erp-status-paid",
        unpaid:
          "erp-status erp-status-unpaid",
        pending:
          "erp-status erp-status-pending",
        partial:
          "erp-status erp-status-partial",
        cancelled:
          "erp-status erp-status-cancelled",
        overdue:
          "erp-status erp-status-overdue",
        draft:
          "erp-status erp-status-draft",
        posted:
          "erp-status erp-status-posted",
        active:
          "erp-status erp-status-active",
        inactive:
          "erp-status erp-status-inactive",
        info:
          "erp-status erp-status-info",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
