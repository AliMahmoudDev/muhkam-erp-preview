import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SectionHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}

function SectionHeader({
  title,
  subtitle,
  actions,
  className,
  children,
  ...props
}: SectionHeaderProps) {
  return (
    <div className={cn('erp-section-header', className)} {...props}>
      {title || subtitle ? (
        <div className="erp-section-title-group">
          {title    && <h2 className="erp-section-title">{title}</h2>}
          {subtitle && <p className="erp-section-subtitle">{subtitle}</p>}
        </div>
      ) : (
        children
      )}
      {actions && <div className="erp-section-actions">{actions}</div>}
    </div>
  );
}
SectionHeader.displayName = 'SectionHeader';

export interface SectionProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}

const Section = React.forwardRef<HTMLElement, SectionProps>(
  ({ title, subtitle, actions, className, children, ...props }, ref) => (
    <section ref={ref} className={cn('erp-section', className)} {...props}>
      {(title !== undefined || subtitle !== undefined || actions !== undefined) && (
        <SectionHeader title={title} subtitle={subtitle} actions={actions} />
      )}
      {children}
    </section>
  ),
);
Section.displayName = 'Section';

export { Section, SectionHeader };
