import * as React from "react"
import { cn } from "@/lib/utils"

export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical"
  label?: React.ReactNode
}

const Divider = React.forwardRef<HTMLDivElement, DividerProps>(
  ({ className, orientation = "horizontal", label, ...props }, ref) => {
    if (label) {
      return (
        <div
          ref={ref}
          role="separator"
          aria-orientation={orientation}
          className={cn("erp-divider erp-divider-labeled", className)}
          {...props}
        >
          <span className="erp-divider-line" />
          <span className="erp-divider-label">{label}</span>
          <span className="erp-divider-line" />
        </div>
      )
    }

    return (
      <div
        ref={ref}
        role="separator"
        aria-orientation={orientation}
        className={cn(
          "erp-divider",
          orientation === "vertical" ? "erp-divider-vertical" : "erp-divider-horizontal",
          className
        )}
        {...props}
      />
    )
  }
)
Divider.displayName = "Divider"

export { Divider }
