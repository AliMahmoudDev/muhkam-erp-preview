import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const iconButtonVariants = cva(
  "erp-icon-btn inline-flex items-center justify-center flex-shrink-0 cursor-pointer border transition-[background,color,border-color,box-shadow] focus-visible:outline-none disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:     "",
        primary:     "erp-icon-btn-primary",
        ghost:       "erp-icon-btn-ghost",
        destructive: "erp-icon-btn-destructive",
      },
      size: {
        sm: "erp-icon-btn-sm [&_svg]:size-4",
        md: "erp-icon-btn-md [&_svg]:size-5",
        lg: "erp-icon-btn-lg [&_svg]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size:    "md",
    },
  }
)

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  asChild?: boolean
  "aria-label": string
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        ref={ref}
        className={cn(iconButtonVariants({ variant, size }), className)}
        {...props}
      />
    )
  }
)
IconButton.displayName = "IconButton"

export { IconButton, iconButtonVariants }
