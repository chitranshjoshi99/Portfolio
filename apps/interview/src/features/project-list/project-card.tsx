import { Link } from 'react-router-dom';
import type { Project } from '../../projects/project.types';
import { GuideLink } from '../guide-link';

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    // An <article>, not a <Link>: the guide link has to be a sibling of the card link,
    // because an anchor inside an anchor is invalid HTML.
    <article className="project-card">
      <Link className="project-card__main" to={`/projects/${project.id}`}>
        <div className="project-card__head">
          <h2 className="project-card__title">{project.title}</h2>
          <span className={`badge badge--${project.difficulty}`}>{project.difficulty}</span>
        </div>
        <p className="project-card__description">{project.description}</p>
        <ul className="project-card__tags">
          {project.tags.map((tag) => (
            <li key={tag} className="tag">
              {tag}
            </li>
          ))}
        </ul>
      </Link>

      {project.guideUrl && (
        <GuideLink href={project.guideUrl} title={project.title} className="project-card__guide" />
      )}
    </article>
  );
}
