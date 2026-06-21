import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.ComponentProps<"input"> {
  invalid?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, invalid, "aria-invalid": ariaInvalid, ...props }, ref) => {
    return (
      <input
        type={type}
        data-invalid={invalid || ariaInvalid ? "" : undefined}
        aria-invalid={invalid || (ariaInvalid as boolean) ? true : undefined}
        className={cn(
          "erp-input",
          "flex h-10 w-full px-3 py-2 text-sm transition-[border-color,box-shadow]",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--color-text-primary)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
