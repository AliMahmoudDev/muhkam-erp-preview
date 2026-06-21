/**
 * AuthPattern — centered authentication card layout.
 *
 * Structure:
 *   Full-viewport centered shell
 *   └── Card
 *       ├── brandSlot  (logo, app name)
 *       ├── feedbackSlot (error/success — aria-live)
 *       ├── formSlot   (login/register form fields)
 *       └── footerSlot (help links, back, language switcher)
 *
 * No auth logic. No token management. No redirect logic.
 * All content arrives via slots.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export type AuthCardSize = 'sm' | 'md' | 'lg';

export interface AuthPatternProps {
  /**
   * Brand / logo slot — app logo, product name, tagline.
   * Rendered at the top of the card, centered.
   */
  brandSlot?: React.ReactNode;

  /**
   * Form slot — input fields, submit button, remember-me checkbox.
   * Required: the auth form is the core content of this pattern.
   */
  formSlot: React.ReactNode;

  /**
   * Feedback slot — error or success message (aria-live polite).
   * Renders above the form. The caller controls when it appears.
   */
  feedbackSlot?: React.ReactNode;

  /**
   * Footer / help slot — "forgot password", "contact support",
   * language switcher, or back-to-site links.
   * Rendered at the bottom of the card with a separator.
   */
  footerSlot?: React.ReactNode;

  /**
   * Card width variant.
   * 'sm' → 360px — simple PIN / OTP verification
   * 'md' → 420px — standard login (default)
   * 'lg' → 520px — registration or multi-step setup
   */
  size?: AuthCardSize;

  className?: string;
}

const SIZE_CLASS: Record<AuthCardSize, string> = {
  sm: 'erp-auth-card--sm',
  md: '',
  lg: 'erp-auth-card--lg',
};

export function AuthPattern({
  brandSlot,
  formSlot,
  feedbackSlot,
  footerSlot,
  size = 'md',
  className,
}: AuthPatternProps) {
  return (
    <div className={cn('erp-auth', className)}>
      <div className={cn('erp-auth-card', SIZE_CLASS[size])}>

        {/* Brand / logo area */}
        {brandSlot && (
          <div className="erp-auth-brand" aria-label="هوية التطبيق">
            {brandSlot}
          </div>
        )}

        {/* Feedback — error or success message */}
        {feedbackSlot && (
          <div
            className="erp-auth-feedback"
            role="status"
            aria-live="polite"
          >
            {feedbackSlot}
          </div>
        )}

        {/* Auth form */}
        <div className="erp-auth-form">
          {formSlot}
        </div>

        {/* Footer links */}
        {footerSlot && (
          <div className="erp-auth-footer">
            {footerSlot}
          </div>
        )}

      </div>
    </div>
  );
}
