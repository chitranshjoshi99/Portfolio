import { Suspense } from 'react';
import { Link, useParams } from 'react-router-dom';
import { findProject } from '../../projects/project-registry';
import { GuideLink } from '../guide-link';
import './project-page.css';

export function ProjectPage() {
  const { projectId } = useParams();
  const project = findProject(projectId);

  if (!project) {
    return (
      <main className="project-page">
        <Link className="project-page__back" to="/">
          ← All projects
        </Link>
        <h1 className="project-page__title">Project not found</h1>
      </main>
    );
  }

  const { Component } = project;

  return (
    <main className="project-page">
      <header className="project-page__header">
        <Link className="project-page__back" to="/">
          ← All projects
        </Link>
        <div className="project-page__title-row">
          <h1 className="project-page__title">{project.title}</h1>
          {project.guideUrl && (
            <GuideLink
              href={project.guideUrl}
              title={project.title}
              className="project-page__guide"
            />
          )}
        </div>
        <p className="project-page__description">{project.description}</p>
      </header>
      <Suspense fallback={<p className="project-page__loading">Loading…</p>}>
        <Component />
      </Suspense>
    </main>
  );
}
