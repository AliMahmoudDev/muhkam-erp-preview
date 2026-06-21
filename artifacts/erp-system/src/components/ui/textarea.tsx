import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  invalid?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, "aria-invalid": ariaInvalid, ...props }, ref) => {
    return (
      <textarea
        data-invalid={invalid || ariaInvalid ? "" : undefined}
        aria-invalid={invalid || (ariaInvalid as boolean) ? true : undefined}
        className={cn(
          "erp-input erp-textarea",
          "flex w-full px-3 py-2.5 text-sm transition-[border-color,box-shadow]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
