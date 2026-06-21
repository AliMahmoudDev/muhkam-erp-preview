import * as React from "react"
import { AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ErrorTextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  showIcon?: boolean
}

const ErrorText = React.forwardRef<HTMLParagraphElement, ErrorTextProps>(
  ({ className, children, showIcon = true, ...props }, ref) => (
    <p
      ref={ref}
      role="alert"
      aria-live="polite"
      className={cn("erp-error-text", className)}
      {...props}
    >
      {showIcon && <AlertCircle aria-hidden="true" />}
      <span>{children}</span>
    </p>
  )
)
ErrorText.displayName = "ErrorText"

export { ErrorText }
