import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * Stable list of admin tabs. Kept here (not in AdminPanel) so any nested admin
 * component can navigate between tabs via `useAdminTab().goToTab(...)` without
 * importing types from a sibling component.
 */
export type AdminTab =
  | 'drivers'
  | 'review'
  | 'verification'
  | 'vehicles'
  | 'incidents'
  | 'emergency'
  | 'oncall'
  | 'schedule'
  | 'notifications'
  | 'stats'
  | 'stripe'
  | 'pages';

/**
 * Loose key/value bag of params attached to the current tab. We intentionally
 * keep this tiny + string-only — it's not a router, just a way to focus a row
 * (e.g. `{ template_id: '...' }` on the Shift Schedule tab).
 */
export type AdminTabParams = Record<string, string>;

interface AdminTabContextValue {
  activeTab: AdminTab;
  tabParams: AdminTabParams;
  setActiveTab: (tab: AdminTab) => void;
  /**
   * Switch to `tab` and (optionally) attach params. Calling with the same tab
   * still updates params, so a "deep-link from another card" flow works even
   * when the user is already on the destination tab.
   */
  goToTab: (tab: AdminTab, params?: AdminTabParams) => void;
  /**
   * Clear a single param key from the current tab. Use this once a consumer
   * has acted on a focus param (e.g. scrolled to the highlighted row) so the
   * highlight doesn't re-trigger on subsequent re-renders.
   */
  clearTabParam: (key: string) => void;
}

const AdminTabContext = createContext<AdminTabContextValue | null>(null);

export const AdminTabProvider: React.FC<{
  initialTab?: AdminTab;
  children: React.ReactNode;
}> = ({ initialTab = 'drivers', children }) => {
  const [activeTab, setActiveTabState] = useState<AdminTab>(initialTab);
  const [tabParams, setTabParams] = useState<AdminTabParams>({});

  const setActiveTab = useCallback((tab: AdminTab) => {
    setActiveTabState(tab);
    // Plain tab clicks reset focus params — only goToTab carries them.
    setTabParams({});
  }, []);

  const goToTab = useCallback((tab: AdminTab, params?: AdminTabParams) => {
    setActiveTabState(tab);
    setTabParams(params ?? {});
  }, []);

  const clearTabParam = useCallback((key: string) => {
    setTabParams((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const value = useMemo<AdminTabContextValue>(
    () => ({ activeTab, tabParams, setActiveTab, goToTab, clearTabParam }),
    [activeTab, tabParams, setActiveTab, goToTab, clearTabParam],
  );

  return <AdminTabContext.Provider value={value}>{children}</AdminTabContext.Provider>;
};

/**
 * Hook for any admin sub-component. Throws if used outside the provider so
 * we catch wiring mistakes loudly during development.
 */
export const useAdminTab = (): AdminTabContextValue => {
  const ctx = useContext(AdminTabContext);
  if (!ctx) {
    throw new Error('useAdminTab must be used inside <AdminTabProvider>');
  }
  return ctx;
};
