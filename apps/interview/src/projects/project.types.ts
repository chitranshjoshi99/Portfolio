import type { ComponentType } from 'react';

export type ProjectDifficulty = 'easy' | 'medium' | 'hard';

export interface Project {
  /** URL slug, also the React key. Kebab case. */
  id: string;
  title: string;
  description: string;
  difficulty: ProjectDifficulty;
  tags: string[];
  /** Rendered at /projects/:id */
  Component: ComponentType;
  /** Published build guide, opened in a new tab from the listing card. */
  guideUrl?: string;
}
