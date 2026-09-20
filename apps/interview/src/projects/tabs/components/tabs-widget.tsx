import { useRef } from 'react';
import { ISSUE_TABS, URL_PARAM } from '../constants/tabs.constants';
import { useInView } from '../hooks/use-in-view';
import { useTabs } from '../hooks/use-tabs';
import type { ActivationMode } from '../tabs.types';
import { IssuePanel } from './issue-panel';

interface TabsWidgetProps {
  activation: ActivationMode;
  keepMounted: boolean;
  syncUrl: boolean;
  deferUntilVisible: boolean;
}

export function TabsWidget({ activation, keepMounted, syncUrl, deferUntilVisible }: TabsWidgetProps) {
  const tabs = useTabs({
    tabs: ISSUE_TABS,
    defaultId: 'summary',
    activation,
    keepMounted,
    urlParam: syncUrl ? URL_PARAM : null,
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const onScreen = useInView(rootRef, deferUntilVisible);

  return (
    <div className="tb__widget" ref={rootRef}>
      <div className="tb__list" {...tabs.getTabListProps('Issue CONF-4121')}>
        {ISSUE_TABS.map((tab) => (
          <button key={tab.id} className="tb__tab" {...tabs.getTabProps(tab)}>
            {tab.label}
            {tabs.visited.has(tab.id) && <span className="tb__dot" aria-hidden="true" />}
          </button>
        ))}
      </div>
      {ISSUE_TABS.map((tab) => (
        <div key={tab.id} className="tb__panel" {...tabs.getPanelProps(tab.id)}>
          {/* Lazy mount: an unvisited panel renders nothing at all — no component, no request. */}
          {tabs.isMounted(tab.id) && <IssuePanel id={tab.id} canLoad={onScreen} />}
        </div>
      ))}
    </div>
  );
}
