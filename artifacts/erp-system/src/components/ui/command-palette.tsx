import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from 'cmdk';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * CommandPalette — keyboard-first search & action launcher.
 *
 * No business logic or permission filtering inside.
 * Consumers supply `groups` and handle `onSelect` callbacks.
 *
 * Keyboard:
 *   ↑ / ↓   — navigate items
 *   Enter   — select focused item
 *   Escape  — close (handled by Radix Dialog)
 */

export interface CommandPaletteItem {
  id: string;
  label: string;
  /** Lucide icon component or any React element type. */
  icon?: React.ElementType;
  /** Extra search terms matched by cmdk. */
  keywords?: string;
  onSelect?: () => void;
}

export interface CommandPaletteGroup {
  heading?: string;
  items: CommandPaletteItem[];
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups?: CommandPaletteGroup[];
  placeholder?: string;
  emptyMessage?: React.ReactNode;
  className?: string;
}

export function CommandPalette({
  open,
  onOpenChange,
  groups = [],
  placeholder = 'ابحث في الأوامر والصفحات…',
  emptyMessage = 'لا توجد نتائج مطابقة',
  className,
}: CommandPaletteProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Overlay */}
        <DialogPrimitive.Overlay
          className={cn(
            'erp-dialog-overlay',
            'fixed inset-0 z-50',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          )}
        />

        {/* Palette panel */}
        <DialogPrimitive.Content
          className={cn('erp-command-palette', className)}
          aria-label="لوحة الأوامر"
        >
          <Command
            className="erp-command"
            loop
          >
            {/* Search bar */}
            <div className="erp-command-input-wrap">
              <Search
                className="erp-command-search-icon"
                aria-hidden="true"
              />
              <CommandInput
                className="erp-command-input"
                placeholder={placeholder}
                autoFocus
              />
            </div>

            {/* Results list */}
            <CommandList className="erp-command-list">
              <CommandEmpty className="erp-command-empty">
                {emptyMessage}
              </CommandEmpty>

              {groups.map((group, gi) => (
                <React.Fragment key={gi}>
                  {gi > 0 && <CommandSeparator className="erp-command-separator" />}
                  <CommandGroup
                    heading={group.heading}
                    className="erp-command-group"
                  >
                    {group.items.map((item) => {
                      const ItemIcon = item.icon;
                      return (
                        <CommandItem
                          key={item.id}
                          value={item.id}
                          keywords={item.keywords ? [item.keywords] : undefined}
                          onSelect={() => {
                            item.onSelect?.();
                            onOpenChange(false);
                          }}
                          className="erp-command-item"
                        >
                          {ItemIcon && (
                            <span className="erp-command-item-icon" aria-hidden="true">
                              <ItemIcon />
                            </span>
                          )}
                          <span className="erp-command-item-label">{item.label}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </React.Fragment>
              ))}
            </CommandList>

            {/* Footer hint */}
            <div className="erp-command-footer" aria-hidden="true">
              <span><kbd>↑</kbd><kbd>↓</kbd> للتنقل</span>
              <span className="erp-command-footer-sep" />
              <span><kbd>↵</kbd> تحديد</span>
              <span className="erp-command-footer-sep" />
              <span><kbd>Esc</kbd> إغلاق</span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
