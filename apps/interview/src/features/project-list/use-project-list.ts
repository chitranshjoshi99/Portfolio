import { useMemo, useState } from 'react';
import { projects } from '../../projects/project-registry';
import type { Project } from '../../projects/project.types';

interface UseProjectList {
  query: string;
  setQuery: (query: string) => void;
  visibleProjects: Project[];
  totalCount: number;
}

const matches = (project: Project, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    project.title.toLowerCase().includes(needle) ||
    project.description.toLowerCase().includes(needle) ||
    project.tags.some((tag) => tag.includes(needle))
  );
};

export function useProjectList(): UseProjectList {
  const [query, setQuery] = useState('');

  const visibleProjects = useMemo(
    () => projects.filter((project) => matches(project, query)),
    [query],
  );

  return { query, setQuery, visibleProjects, totalCount: projects.length };
}
