/**
 * LandingPattern — public marketing / landing page shell.
 *
 * Structure (RTL-first, full-width sections):
 *   heroSlot      — full-width hero banner
 *   featuresSlot  — product feature sections
 *   proofSlot     — social proof / testimonials / logos
 *   pricingSlot   — pricing tiers / CTA
 *   footerSlot    — site footer
 *
 * Each slot is a full-width section; internal layout is the caller's
 * responsibility. No marketing logic. No analytics calls.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface LandingPatternProps {
  /**
   * Hero slot — full-width opening section.
   * Typically includes headline, subline, CTA button, and hero image.
   * Required: a landing page must have a hero.
   */
  heroSlot: React.ReactNode;

  /**
   * Features slot — product capability sections.
   * Can contain multiple alternating image/text blocks.
   */
  featuresSlot?: React.ReactNode;

  /**
   * Social proof slot — testimonials, logos, stats.
   * Often a lighter background section for visual contrast.
   */
  proofSlot?: React.ReactNode;

  /**
   * Pricing / CTA slot — pricing cards and primary call-to-action.
   */
  pricingSlot?: React.ReactNode;

  /**
   * Footer slot — navigation links, legal, contact, social icons.
   */
  footerSlot?: React.ReactNode;

  className?: string;
}

export function LandingPattern({
  heroSlot,
  featuresSlot,
  proofSlot,
  pricingSlot,
  footerSlot,
  className,
}: LandingPatternProps) {
  return (
    <div className={cn('erp-landing', className)}>

      {/* Hero — full viewport opening */}
      <section className="erp-landing-hero" aria-label="الصفحة الرئيسية">
        {heroSlot}
      </section>

      {/* Feature sections */}
      {featuresSlot && (
        <section className="erp-landing-section erp-landing-features" aria-label="المميزات">
          {featuresSlot}
        </section>
      )}

      {/* Social proof */}
      {proofSlot && (
        <section className="erp-landing-section erp-landing-proof" aria-label="آراء العملاء">
          {proofSlot}
        </section>
      )}

      {/* Pricing / CTA */}
      {pricingSlot && (
        <section className="erp-landing-section erp-landing-pricing" aria-label="الأسعار">
          {pricingSlot}
        </section>
      )}

      {/* Footer */}
      {footerSlot && (
        <footer className="erp-landing-footer" aria-label="تذييل الصفحة">
          {footerSlot}
        </footer>
      )}

    </div>
  );
}
