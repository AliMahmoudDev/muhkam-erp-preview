import * as React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast';

const DURATION = 1800;

const VARIANT_ICON: Record<string, React.ElementType> = {
  default:     CheckCircle2,
  success:     CheckCircle2,
  destructive: XCircle,
  error:       XCircle,
  warning:     AlertTriangle,
  info:        Info,
};

function ToastItem({
  id,
  title,
  description,
  action,
  variant = 'default',
  open,
  onOpenChange,
}: {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactElement;
  variant?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const Icon = VARIANT_ICON[variant] ?? CheckCircle2;

  return (
    <Toast
      key={id}
      variant={variant as Parameters<typeof Toast>[0]['variant']}
      open={open}
      onOpenChange={onOpenChange}
      duration={DURATION}
    >
      {/* Progress bar — colour comes from CSS var(--toast-bar-color) set by variant class */}
      <div className="absolute bottom-0 start-0 end-0 h-[2px] overflow-hidden rounded-b-xl" style={{ background: 'var(--edge)' }}>
        {open && (
          <div
            className="erp-toast-bar h-full"
            style={{
              animation: `toast-shrink ${DURATION}ms linear forwards`,
            }}
          />
        )}
      </div>

      {/* Icon — colour comes from CSS var(--toast-icon-color) set by variant class */}
      <div className="erp-toast-icon shrink-0 mt-0.5">
        <Icon aria-hidden="true" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0" dir="rtl">
        {title       && <ToastTitle>{title}</ToastTitle>}
        {description && <ToastDescription>{description}</ToastDescription>}
      </div>

      {action}

      <ToastClose />
    </Toast>
  );
}

export function Toaster() {
  const { toasts } = useToast();

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
            variant={variant ?? 'default'}
            open={open}
            onOpenChange={onOpenChange}
          />
        ))}
        <ToastViewport />
      </ToastProvider>
    </>
  );
}
