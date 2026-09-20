export type CommentStatus = 'sent' | 'sending' | 'failed';

export interface Comment {
  id: string;
  author: string;
  body: string;
  createdAt: number;
  editedAt?: number;
  /** Only ever 'sent' on the server; the other two are this client's view of its own write. */
  status: CommentStatus;
  /** Kept on a failed comment so Retry can send the same request again. */
  error?: string;
}

export interface Issue {
  id: string;
  key: string;
  summary: string;
  description: string;
  status: 'To Do' | 'In Progress' | 'In Review' | 'Done';
  priority: 'Highest' | 'High' | 'Medium' | 'Low';
  assignee: string | null;
  reporter: string;
  labels: string[];
  points: number;
  created: number;
  updated: number;
}

export type Loadable<T> =
  | { kind: 'loading' }
  | { kind: 'error'; error: string }
  | { kind: 'ready'; value: T };
