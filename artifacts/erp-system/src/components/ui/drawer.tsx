import * as React from 'react';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Drawer — supplementary context panel.
 *
 * RTL-first: opens from the logical-end side which is the physical
 * LEFT in RTL (Arabic) layout. Pass `side="right"` to override for
 * LTR contexts.
 */

export type DrawerSide = 'left' | 'right';
export type DrawerSize = 'sm' | 'md' | 'lg' | 'xl';

const Drawer = SheetPrimitive.Root;
const DrawerTrigger = SheetPrimitive.Trigger;
const DrawerClose = SheetPrimitive.Close;
const DrawerPortal = SheetPrimitive.Portal;

const DrawerOverlay = React.forwardRef<
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
DrawerOverlay.displayName = 'DrawerOverlay';

export interface DrawerContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> {
  /** @default 'left' — logical-end in RTL */
  side?: DrawerSide;
  size?: DrawerSize;
}

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  DrawerContentProps
>(({ side = 'left', size = 'md', className, children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(
        'erp-drawer',
        `erp-drawer--${size}`,
        side === 'left'  && 'erp-drawer--start',
        side === 'right' && 'erp-drawer--end',
        'fixed inset-y-0 z-50 h-full',
        side === 'left'  && [
          'left-0',
          'data-[state=open]:slide-in-from-left',
          'data-[state=closed]:slide-out-to-left',
        ],
        side === 'right' && [
          'right-0',
          'data-[state=open]:slide-in-from-right',
          'data-[state=closed]:slide-out-to-right',
        ],
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=open]:duration-300 data-[state=closed]:duration-200',
        className,
      )}
      {...props}
    >
      {children}
      <SheetPrimitive.Close className="erp-drawer-close" aria-label="إغلاق">
        <X aria-hidden="true" />
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </DrawerPortal>
));
DrawerContent.displayName = 'DrawerContent';

function DrawerHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('erp-drawer-header', className)} {...props} />
  );
}
DrawerHeader.displayName = 'DrawerHeader';

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn('erp-drawer-title', className)}
    {...props}
  />
));
DrawerTitle.displayName = 'DrawerTitle';

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn('erp-drawer-description', className)}
    {...props}
  />
));
DrawerDescription.displayName = 'DrawerDescription';

function DrawerBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('erp-drawer-body', className)} {...props} />;
}
DrawerBody.displayName = 'DrawerBody';

function DrawerFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('erp-drawer-footer', className)} {...props} />;
}
DrawerFooter.displayName = 'DrawerFooter';

export {
  Drawer,
  DrawerTrigger,
  DrawerClose,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerBody,
  DrawerFooter,
};
