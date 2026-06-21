import * as React from "react"
import { cn } from "@/lib/utils"

const HelperText = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("erp-helper-text", className)}
    {...props}
  >
    {children}
  </p>
))
HelperText.displayName = "HelperText"

export { HelperText }
