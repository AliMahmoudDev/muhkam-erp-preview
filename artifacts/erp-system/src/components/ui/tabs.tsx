import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

/**
 * Tabs — same-context content switching (never cross-page navigation).
 *
 * Variants:
 *   underline  — active trigger has a bottom border accent (default)
 *   pill       — active trigger has a rounded background
 *
 * Keyboard: Radix handles arrow-key navigation within the tab list.
 * RTL: Radix respects the document's dir attribute for arrow-key order.
 */

export type TabsVariant = 'underline' | 'pill';

const TabsVariantContext = React.createContext<TabsVariant>('underline');

export interface TabsProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root> {
  variant?: TabsVariant;
}

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  TabsProps
>(({ variant = 'underline', className, ...props }, ref) => (
  <TabsVariantContext.Provider value={variant}>
    <TabsPrimitive.Root
      ref={ref}
      className={cn('erp-tabs', className)}
      {...props}
    />
  </TabsVariantContext.Provider>
));
Tabs.displayName = 'Tabs';

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
  const variant = React.useContext(TabsVariantContext);
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        'erp-tabs-list',
        variant === 'underline' && 'erp-tabs-list--underline',
        variant === 'pill'      && 'erp-tabs-list--pill',
        className,
      )}
      {...props}
    />
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  const variant = React.useContext(TabsVariantContext);
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        'erp-tabs-trigger',
        variant === 'underline' && 'erp-tabs-trigger--underline',
        variant === 'pill'      && 'erp-tabs-trigger--pill',
        className,
      )}
      {...props}
    />
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('erp-tabs-content', className)}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
