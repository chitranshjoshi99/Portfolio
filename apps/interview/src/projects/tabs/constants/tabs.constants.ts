import type { TabDefinition } from '../tabs.types';

export const ISSUE_TABS: TabDefinition[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'comments', label: 'Comments' },
  { id: 'history', label: 'History' },
  { id: 'attachments', label: 'Attachments', disabled: true },
  { id: 'worklog', label: 'Work log' },
];

export const URL_PARAM = 'tab';
export const LATENCY_MS = 600;

export const PANEL_CONTENT: Record<string, string[]> = {
  summary: ['CONF-4121 · Editor drops selection after paste', 'Priority: High · Assignee: Priya', 'Sprint: Pikachu 42'],
  comments: ['Priya: repro on Safari 18 only', 'Sam: bisected to the paste plugin', 'Lee: fix in review'],
  history: ['Status: To Do → In Progress', 'Assignee: none → Priya', 'Priority: Medium → High'],
  attachments: ['screen-recording.mov'],
  worklog: ['Priya logged 2h', 'Sam logged 45m'],
};
