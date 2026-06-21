import * as React from 'react';
import { cn } from '@/lib/utils';

export type CardVariant = 'default' | 'elevated' | 'interactive' | 'selected';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Visual variant.
   * - `default`     standard surface (default)
   * - `elevated`    adds hover shadow lift
   * - `interactive` cursor pointer + stronger hover border
   * - `selected`    accent border + muted accent background
   */
  variant?: CardVariant;
  /**
   * Convenience padding on the root element.
   * When using CardHeader/CardContent/CardFooter slots, leave as `none`.
   */
  padding?: CardPadding;
  /**
   * @warning Card inside Card is forbidden by design spec.
   * Use Panel for nested structural surfaces.
   */
  _allowNested?: never;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', padding = 'none', className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'erp-card',
        variant === 'elevated'    && 'erp-card--elevated',
        variant === 'interactive' && 'erp-card--interactive erp-card--clickable',
        variant === 'selected'    && 'erp-card--selected',
        padding === 'sm'  && 'erp-card--pad-sm',
        padding === 'md'  && 'erp-card--pad-md',
        padding === 'lg'  && 'erp-card--pad-lg',
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('erp-card-header', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('erp-card-title', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('erp-card-subtitle', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('erp-card-body', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('erp-card-footer', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
