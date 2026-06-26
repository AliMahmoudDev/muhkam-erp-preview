import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingPage } from '@/components/loading-page';

describe('LoadingPage', () => {
  it('renders without crashing', () => {
    const { container } = render(<LoadingPage />);
    expect(container).toBeTruthy();
  });

  it('shows the brand name مُحكم', () => {
    render(<LoadingPage />);
    expect(screen.getByText('مُحكم')).toBeInTheDocument();
  });

  it('shows MUHKAM ERP subtitle', () => {
    render(<LoadingPage />);
    expect(screen.getByText('MUHKAM ERP')).toBeInTheDocument();
  });

  it('shows loading text', () => {
    render(<LoadingPage />);
    expect(screen.getByText('جارٍ التحميل')).toBeInTheDocument();
  });

  it('uses light background', () => {
    const { container } = render(<LoadingPage />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.background).toMatch(/245,\s*245,\s*245|F5F5F5/i);
  });

  it('renders the SVG logo', () => {
    const { container } = render(<LoadingPage />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('includes animation keyframes in style tag', () => {
    const { container } = render(<LoadingPage />);
    const style = container.querySelector('style');
    expect(style?.textContent).toContain('lp-ld-pulse');
    expect(style?.textContent).toContain('lp-ld-shimmer');
  });

  it('has fixed positioning (full-screen overlay)', () => {
    const { container } = render(<LoadingPage />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain('fixed');
    expect(wrapper.className).toContain('inset-0');
  });
});
