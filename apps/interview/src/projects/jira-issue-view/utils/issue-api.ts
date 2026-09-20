import type { Comment, Issue } from '../jira-issue-view.types.ts';

export const apiControl = { latencyMs: 500, failNextComment: false, failIssue: false };

const ISSUE: Issue = {
  id: 'i-4137',
  key: 'CONF-4137',
  summary: 'Editor drops the selection after pasting a table',
  description:
    'Paste a table from Google Docs into the editor and the caret jumps to the start of the document. ' +
    'Reproduced on Chrome 141 and Safari 19. The selection is restored correctly for plain text, so it ' +
    'looks like the table transform replaces the node without re-mapping the selection.',
  status: 'In Progress',
  priority: 'High',
  assignee: 'Priya',
  reporter: 'Sam',
  labels: ['editor', 'regression', 'cloud'],
  points: 5,
  created: Date.UTC(2026, 8, 12, 9, 14),
  updated: Date.UTC(2026, 8, 20, 8, 2),
};

const SERVER_COMMENTS: Comment[] = [
  {
    id: 'c1',
    author: 'Sam',
    body: 'Repro is reliable with a 3×3 table. Plain paste is fine, so it is the table transform.',
    createdAt: Date.UTC(2026, 8, 12, 10, 2),
    status: 'sent',
  },
  {
    id: 'c2',
    author: 'Lee',
    body: 'The transform replaces the node and never re-maps the selection. Patch is small.',
    createdAt: Date.UTC(2026, 8, 19, 16, 40),
    status: 'sent',
  },
];

let nextId = 3;

const delay = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

export async function fetchIssue(signal?: AbortSignal): Promise<Issue> {
  await delay(apiControl.latencyMs, signal);
  if (apiControl.failIssue) throw new Error('500 — could not load the issue');
  return ISSUE;
}

export async function fetchComments(signal?: AbortSignal): Promise<Comment[]> {
  // Comments are a second request on purpose: the issue renders before they arrive.
  await delay(apiControl.latencyMs + 250, signal);
  return SERVER_COMMENTS.map((comment) => ({ ...comment }));
}

export async function postComment(body: string, author: string): Promise<Comment> {
  await delay(apiControl.latencyMs + 200);
  if (apiControl.failNextComment) {
    apiControl.failNextComment = false;
    throw new Error('409 — comment rejected, the issue changed');
  }
  const saved: Comment = {
    id: `c${nextId++}`,
    author,
    body,
    createdAt: Date.now(),
    status: 'sent',
  };
  SERVER_COMMENTS.push({ ...saved });
  return saved;
}

export async function patchComment(id: string, body: string): Promise<Comment> {
  await delay(apiControl.latencyMs);
  if (apiControl.failNextComment) {
    apiControl.failNextComment = false;
    throw new Error('409 — someone edited this comment first');
  }
  const found = SERVER_COMMENTS.find((comment) => comment.id === id);
  if (!found) throw new Error('404 — comment is gone');
  found.body = body;
  found.editedAt = Date.now();
  return { ...found };
}

export async function deleteComment(id: string): Promise<void> {
  await delay(apiControl.latencyMs);
  if (apiControl.failNextComment) {
    apiControl.failNextComment = false;
    throw new Error('403 — you can only delete your own comments');
  }
  const index = SERVER_COMMENTS.findIndex((comment) => comment.id === id);
  if (index !== -1) SERVER_COMMENTS.splice(index, 1);
}

export async function updateIssue(patch: Partial<Issue>): Promise<Issue> {
  await delay(apiControl.latencyMs);
  Object.assign(ISSUE, patch, { updated: Date.now() });
  return { ...ISSUE };
}
