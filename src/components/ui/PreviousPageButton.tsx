/**
 * PreviousPageButton
 *
 * Lightweight, reusable "Previous Page" navigation control that returns
 * the user to the immediately prior entry in the browser history stack
 * via `navigate(-1)`.
 *
 * Scope:
 *   - Pure UI helper. Does NOT touch routing architecture, auth, onboarding
 *     gates, dashboards, Mapbox, pricing, Stripe, Twilio, or any backend.
 *   - Used alongside (not replacing) existing "Back to Home" links.
 *   - Should NOT be rendered on the homepage.
 *
 * If there is no prior history entry (e.g. user opened the URL directly
 * in a fresh tab), we fall back to the homepage so the button is never
 * a dead-end.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface PreviousPageButtonProps {
  /** Optional className overrides */
  className?: string;
  /** Custom label (defaults to "Previous Page") */
  label?: string;
  /** Optional fallback path if there's no history entry (defaults to "/") */
  fallbackPath?: string;
}

export const PreviousPageButton: React.FC<PreviousPageButtonProps> = ({
  className = '',
  label = 'Previous Page',
  fallbackPath = '/',
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    // history.state.idx is set by react-router; if idx > 0, there is a prior entry.
    // Fall back gracefully when the page was opened directly.
    const hasHistory =
      typeof window !== 'undefined' &&
      window.history &&
      (window.history.state?.idx ?? 0) > 0;

    if (hasHistory) {
      navigate(-1);
    } else {
      navigate(fallbackPath);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      className={
        className ||
        'inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors'
      }
    >
      <ArrowLeft className="w-4 h-4" />
      {label}
    </button>
  );
};

export default PreviousPageButton;
