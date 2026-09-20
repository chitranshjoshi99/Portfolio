import { BIG_SPACE_SIZE, LATENCY_MS, ROOT_ID } from '../constants/page-tree.constants';
import type { PageSummary } from '../page-tree.types';

const TREE: Record<string, PageSummary[]> = {
  [ROOT_ID]: [
    { id: 'eng', title: 'Engineering', hasChildren: true },
    { id: 'product', title: 'Product', hasChildren: true },
    { id: 'design', title: 'Design system', hasChildren: true },
    { id: 'big', title: `Archive (${BIG_SPACE_SIZE.toLocaleString()} pages)`, hasChildren: true },
    { id: 'onboarding', title: 'Onboarding', hasChildren: false },
  ],
  eng: [
    { id: 'eng-arch', title: 'Architecture decisions', hasChildren: true },
    { id: 'eng-runbooks', title: 'Runbooks', hasChildren: true },
    { id: 'eng-oncall', title: 'On-call handbook', hasChildren: false },
  ],
  'eng-arch': [
    { id: 'adr-1', title: 'ADR-001 Frontend state', hasChildren: false },
    { id: 'adr-2', title: 'ADR-002 Editor collaboration', hasChildren: false },
    { id: 'adr-3', title: 'ADR-003 Flag service', hasChildren: false },
  ],
  'eng-runbooks': [
    { id: 'rb-deploy', title: 'Deploying the editor', hasChildren: false },
    { id: 'rb-rollback', title: 'Rolling back', hasChildren: false },
  ],
  product: [
    { id: 'prd-roadmap', title: 'Roadmap 2026', hasChildren: false },
    { id: 'prd-research', title: 'Research', hasChildren: true },
  ],
  'prd-research': [{ id: 'res-1', title: 'Interviews: board users', hasChildren: false }],
  design: [
    { id: 'ds-tokens', title: 'Tokens', hasChildren: false },
    { id: 'ds-components', title: 'Components', hasChildren: false },
  ],
};

export const apiControl = { failNext: false, requests: 0 };

/** GET /pages/:id/children. Children of the archive are generated so the list is genuinely large. */
export function fetchChildren(parentId: string): Promise<PageSummary[]> {
  apiControl.requests += 1;
  const shouldFail = apiControl.failNext;
  apiControl.failNext = false;
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (shouldFail) return reject(new Error(`GET /pages/${parentId}/children → 500`));
      if (parentId === 'big') {
        return resolve(
          Array.from({ length: BIG_SPACE_SIZE }, (_, i) => ({
            id: `big-${i}`,
            title: `Meeting notes ${String(i + 1).padStart(4, '0')}`,
            hasChildren: false,
          })),
        );
      }
      resolve(TREE[parentId] ?? []);
    }, LATENCY_MS);
  });
}
