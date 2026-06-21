import * as React from 'react';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * BottomSheet — mobile-first surface that slides up from the bottom.
 *
 * On desktop (≥ md breakpoint) it continues to render as a bottom sheet.
 * When you need a desktop fallback, use <Drawer> or <Dialog> instead.
 *
 * Snap sizes:
 *   auto   — height determined by content (default)
 *   half   — 50svh
 *   full   — 90svh
 */

export type BottomSheetSnap = 'auto' | 'half' | 'full';

const BottomSheet        = SheetPrimitive.Root;
const BottomSheetTrigger = SheetPrimitive.Trigger;
const BottomSheetClose   = SheetPrimitive.Close;
const BottomSheetPortal  = SheetPrimitive.Portal;

const BottomSheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    ref={ref}
    className={cn(
      'erp-drawer-overlay',
      'fixed inset-0 z-50',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
));
BottomSheetOverlay.displayName = 'BottomSheetOverlay';

export interface BottomSheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> {
  snap?: BottomSheetSnap;
  /** Show top drag handle */
  showHandle?: boolean;
}

const BottomSheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  BottomSheetContentProps
>(({ snap = 'auto', showHandle = true, className, children, ...props }, ref) => (
  <BottomSheetPortal>
    <BottomSheetOverlay />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(
        'erp-bottom-sheet',
        snap === 'half' && 'erp-bottom-sheet--half',
        snap === 'full' && 'erp-bottom-sheet--full',
        'fixed inset-x-0 bottom-0 z-50',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=open]:slide-in-from-bottom',
        'data-[state=closed]:slide-out-to-bottom',
        'data-[state=open]:duration-300 data-[state=closed]:duration-200',
        className,
      )}
      {...props}
    >
      {showHandle && (
        <div className="erp-bottom-sheet-handle" aria-hidden="true" />
      )}
      {children}
      <SheetPrimitive.Close className="erp-drawer-close" aria-label="إغلاق">
        <X aria-hidden="true" />
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </BottomSheetPortal>
));
BottomSheetContent.displayName = 'BottomSheetContent';

function BottomSheetHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('erp-bottom-sheet-header', className)} {...props} />
  );
}
BottomSheetHeader.displayName = 'BottomSheetHeader';

const BottomSheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn('erp-drawer-title', className)}
    {...props}
  />
));
BottomSheetTitle.displayName = 'BottomSheetTitle';

const BottomSheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn('erp-drawer-description', className)}
    {...props}
  />
));
BottomSheetDescription.displayName = 'BottomSheetDescription';

function BottomSheetBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('erp-bottom-sheet-body', className)} {...props} />
  );
}
BottomSheetBody.displayName = 'BottomSheetBody';

function BottomSheetFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('erp-drawer-footer', className)} {...props} />
  );
}
BottomSheetFooter.displayName = 'BottomSheetFooter';

export {
  BottomSheet,
  BottomSheetTrigger,
  BottomSheetClose,
  BottomSheetPortal,
  BottomSheetOverlay,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetDescription,
  BottomSheetBody,
  BottomSheetFooter,
};
