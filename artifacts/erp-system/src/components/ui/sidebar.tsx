import * as React from 'react';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────────────
   Sidebar Context — passes expanded state to child SidebarItems
───────────────────────────────────────────────────────────────── */
interface SidebarContextValue {
  expanded: boolean;
}

const SidebarContext = React.createContext<SidebarContextValue>({
  expanded: true,
});

export function useSidebarContext() {
  return React.useContext(SidebarContext);
}

/* ─────────────────────────────────────────────────────────────────
   Sidebar — structural shell
   Physical RIGHT in RTL (logical inline-start in RTL = right edge).
   Contains header / nav body / footer slots.
   No permission filtering inside.
───────────────────────────────────────────────────────────────── */
export interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  /** Expanded (240 px) or collapsed (64 px icon-only). */
  expanded?: boolean;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

const Sidebar = React.forwardRef<HTMLElement, SidebarProps>(
  ({ expanded = true, header, footer, className, children, ...props }, ref) => (
    <SidebarContext.Provider value={{ expanded }}>
      <aside
        ref={ref}
        data-expanded={expanded}
        aria-expanded={expanded}
        className={cn(
          'erp-sidebar',
          !expanded && 'erp-sidebar--collapsed',
          className,
        )}
        {...props}
      >
        {header && (
          <div className="erp-sidebar-header">{header}</div>
        )}

        <nav
          className="erp-sidebar-body"
          aria-label="القائمة الجانبية"
        >
          {children}
        </nav>

        {footer && (
          <div className="erp-sidebar-footer">{footer}</div>
        )}
      </aside>
    </SidebarContext.Provider>
  ),
);
Sidebar.displayName = 'Sidebar';

/* ─────────────────────────────────────────────────────────────────
   SidebarGroup — optional grouping with a label
───────────────────────────────────────────────────────────────── */
export interface SidebarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
}

function SidebarGroup({ label, className, children, ...props }: SidebarGroupProps) {
  const { expanded } = useSidebarContext();
  return (
    <div className={cn('erp-sidebar-group', className)} {...props}>
      {label && expanded && (
        <span className="erp-sidebar-group-label" aria-hidden="true">
          {label}
        </span>
      )}
      {children}
    </div>
  );
}
SidebarGroup.displayName = 'SidebarGroup';

/* ─────────────────────────────────────────────────────────────────
   SidebarItem — <a> element, never <button>
   Active state: bg | bold text | accent pill | aria-current="page"
───────────────────────────────────────────────────────────────── */
export interface SidebarItemProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  /** Required — navigation destination. */
  href: string;
  /** Icon component (Lucide or similar). */
  icon?: React.ElementType;
  /** Visible label. Hidden in icon-only (collapsed) mode. */
  label: string;
  /** Marks this item as the current page. */
  active?: boolean;
  /** Prevents navigation; adds visual disabled state. */
  disabled?: boolean;
  /** Optional badge / count slot (hidden when collapsed). */
  badge?: React.ReactNode;
}

const SidebarItem = React.forwardRef<HTMLAnchorElement, SidebarItemProps>(
  (
    { href, icon: Icon, label, active, disabled, badge, className, ...props },
    ref,
  ) => {
    const { expanded } = useSidebarContext();

    return (
      <a
        ref={ref}
        href={disabled ? undefined : href}
        aria-current={active ? 'page' : undefined}
        aria-disabled={disabled ? 'true' : undefined}
        aria-label={expanded ? undefined : label}
        tabIndex={disabled ? -1 : undefined}
        className={cn(
          'erp-sidebar-item',
          active    && 'erp-sidebar-item--active',
          disabled  && 'erp-sidebar-item--disabled',
          className,
        )}
        {...props}
      >
        {Icon && (
          <span className="erp-sidebar-item-icon" aria-hidden="true">
            <Icon />
          </span>
        )}

        {expanded && (
          <>
            <span className="erp-sidebar-item-label">{label}</span>
            {badge !== undefined && badge !== null && (
              <span className="erp-sidebar-item-badge">{badge}</span>
            )}
          </>
        )}
      </a>
    );
  },
);
SidebarItem.displayName = 'SidebarItem';

export { Sidebar, SidebarGroup, SidebarItem };
