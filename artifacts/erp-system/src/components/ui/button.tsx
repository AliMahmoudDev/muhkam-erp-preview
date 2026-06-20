import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "erp-btn inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors focus-visible:outline-none disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:     "erp-btn-primary",
        destructive: "erp-btn-danger",
        outline:     "erp-btn-secondary",
        secondary:   "erp-btn-secondary",
        ghost:       "erp-btn-ghost",
        success:     "erp-btn-success",
        link:        "text-[var(--brand)] underline-offset-4 hover:underline h-auto px-0 py-0 rounded-none border-none bg-transparent shadow-none",
      },
      size: {
        default: "erp-btn-md",
        sm:      "erp-btn-sm",
        lg:      "erp-btn-lg",
        icon:    "erp-btn-icon",
      },
    },
    defaultVariants: {
      variant: "default",
      size:    "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), loading && "erp-btn-loading", className)}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {loading ? (
          <>
            <span className="erp-btn-spinner" aria-hidden="true" />
            <span className="erp-btn-loading-text">{children}</span>
          </>
        ) : children}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
