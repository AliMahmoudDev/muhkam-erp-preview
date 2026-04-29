import * as React from "react"
import { CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

const DURATION = 1800

const VARIANT_CONFIG = {
  default: {
    icon: CheckCircle2,
    iconColor: "text-emerald-400",
    barColor: "bg-emerald-500",
    dotColor: "bg-emerald-400",
  },
  destructive: {
    icon: XCircle,
    iconColor: "text-red-400",
    barColor: "bg-red-500",
    dotColor: "bg-red-400",
  },
  warning: {
    icon: AlertTriangle,
    iconColor: "text-amber-400",
    barColor: "bg-amber-500",
    dotColor: "bg-amber-400",
  },
  info: {
    icon: Info,
    iconColor: "text-blue-400",
    barColor: "bg-blue-500",
    dotColor: "bg-blue-400",
  },
} as const

type ToastVariant = keyof typeof VARIANT_CONFIG

function ToastItem({
  id, title, description, action, variant = "default", open, onOpenChange,
}: {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactElement
  variant?: ToastVariant
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const cfg = VARIANT_CONFIG[variant] ?? VARIANT_CONFIG.default
  const Icon = cfg.icon

  return (
    <Toast
      key={id}
      variant={variant}
      open={open}
      onOpenChange={onOpenChange}
      duration={DURATION}
    >
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5 overflow-hidden rounded-b-xl">
        {open && (
          <div
            className={`h-full ${cfg.barColor} origin-right`}
            style={{
              animation: `toast-shrink ${DURATION}ms linear forwards`,
            }}
          />
        )}
      </div>

      {/* Icon */}
      <div className={`shrink-0 mt-0.5 ${cfg.iconColor}`}>
        <Icon className="w-4 h-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0" dir="rtl">
        {title && <ToastTitle>{title}</ToastTitle>}
        {description && <ToastDescription>{description}</ToastDescription>}
      </div>

      {action}

      <ToastClose />
    </Toast>
  )
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <>
      <style>{`
        @keyframes toast-shrink {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
      `}</style>

      <ToastProvider duration={DURATION}>
        {toasts.map(({ id, title, description, action, variant, open, onOpenChange }) => (
          <ToastItem
            key={id}
            id={id}
            title={title}
            description={description}
            action={action}
            variant={(variant ?? "default") as ToastVariant}
            open={open}
            onOpenChange={onOpenChange}
          />
        ))}
        <ToastViewport />
      </ToastProvider>
    </>
  )
}
