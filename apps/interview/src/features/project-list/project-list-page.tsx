import { ProjectCard } from './project-card';
import { useProjectList } from './use-project-list';
import './project-list.css';

export function ProjectListPage() {
  const { query, setQuery, visibleProjects, totalCount } = useProjectList();

  return (
    <main className="project-list">
      <header className="project-list__header">
        <div>
          <h1 className="project-list__title">Machine Coding Projects</h1>
          <p className="project-list__subtitle">
            {totalCount} project{totalCount === 1 ? '' : 's'} · React + TypeScript interview prep
          </p>
        </div>
        <input
          className="project-list__search"
          type="search"
          placeholder="Search projects…"
          aria-label="Search projects"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </header>

      {visibleProjects.length === 0 ? (
        <p className="project-list__empty">No projects match “{query}”.</p>
      ) : (
        <section className="project-list__grid">
          {visibleProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </section>
      )}
    </main>
  );
}
