import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { ActivationMode, TabDefinition } from '../tabs.types';
import { nextTabId, searchWithTab, tabFromSearch } from '../utils/tabs.utils';

export interface UseTabsOptions {
  tabs: TabDefinition[];
  defaultId: string;
  activation?: ActivationMode;
  /** Keep a panel mounted after its first visit (state, scroll, fetched data survive). */
  keepMounted?: boolean;
  /** Query param to mirror the active tab into. null = don't touch the URL. */
  urlParam?: string | null;
}

/**
 * Headless tabs: all behaviour, no markup. The caller spreads prop getters onto whatever elements it
 * likes — that is the "make it extendable" answer. ARIA, roving focus, lazy mount and URL sync live
 * here once instead of in every tabs widget in the product.
 */
export function useTabs({ tabs, defaultId, activation = 'automatic', keepMounted = true, urlParam = null }: UseTabsOptions) {
  const baseId = useId();
  const [activeId, setActiveId] = useState(() =>
    urlParam ? tabFromSearch(window.location.search, urlParam, tabs, defaultId) : defaultId,
  );
  /** Roving tabindex — differs from activeId only in manual mode, mid-arrowing. */
  const [focusedId, setFocusedId] = useState(activeId);
  /** Panels that have been shown at least once. Lazy mount = never mount what was never shown. */
  const [visited, setVisited] = useState<ReadonlySet<string>>(() => new Set([activeId]));
  const tabRefs = useRef(new Map<string, HTMLElement>());

  const select = useCallback(
    (id: string) => {
      if (tabs.find((tab) => tab.id === id)?.disabled) return;
      setActiveId(id);
      setFocusedId(id);
      setVisited((current) => (current.has(id) ? current : new Set(current).add(id)));
      if (urlParam) {
        // replaceState: a tab switch is not a navigation, so Back leaves the page, not the tab.
        window.history.replaceState(window.history.state, '', searchWithTab(window.location.search, urlParam, id));
      }
    },
    [tabs, urlParam],
  );

  // Back/forward (or another script) changed the URL → follow it.
  useEffect(() => {
    if (!urlParam) return;
    const onPop = () => select(tabFromSearch(window.location.search, urlParam, tabs, defaultId));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [defaultId, select, tabs, urlParam]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const target = nextTabId(tabs, focusedId, event.key);
      if (target === focusedId) return;
      event.preventDefault();
      setFocusedId(target);
      tabRefs.current.get(target)?.focus();
      if (activation === 'automatic') select(target);
    },
    [activation, focusedId, select, tabs],
  );

  const tabDomId = (id: string) => `${baseId}-tab-${id}`;
  const panelDomId = (id: string) => `${baseId}-panel-${id}`;

  const getTabListProps = (label: string) => ({ role: 'tablist', 'aria-label': label, onKeyDown });

  const getTabProps = (tab: TabDefinition) => ({
    id: tabDomId(tab.id),
    role: 'tab',
    type: 'button' as const,
    'aria-selected': tab.id === activeId,
    'aria-controls': panelDomId(tab.id),
    'aria-disabled': tab.disabled || undefined,
    tabIndex: tab.id === focusedId ? 0 : -1,
    ref: (element: HTMLElement | null) => {
      if (element) tabRefs.current.set(tab.id, element);
      else tabRefs.current.delete(tab.id);
    },
    onClick: () => select(tab.id),
    onFocus: () => setFocusedId(tab.id),
  });

  const getPanelProps = (id: string) => ({
    id: panelDomId(id),
    role: 'tabpanel',
    'aria-labelledby': tabDomId(id),
    hidden: id !== activeId,
    tabIndex: 0, // the panel itself is focusable so Tab from the tab list lands in the content
  });

  /** Mount the active panel, plus (keepMounted) any panel already visited. Never an unvisited one. */
  const isMounted = (id: string) => id === activeId || (keepMounted && visited.has(id));

  return { activeId, focusedId, visited, select, isMounted, getTabListProps, getTabProps, getPanelProps };
}
