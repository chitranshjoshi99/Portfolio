import { Link } from 'react-router-dom';
import { findProject } from '../../projects/project-registry';
import './atlassian-bank.css';
import { FREQUENCY_LABELS, ROUND_LABELS, type Round } from './bank.types';
import { useBank } from './use-bank';

const ROUNDS = Object.keys(ROUND_LABELS) as Round[];

export function AtlassianBankPage() {
  const b = useBank();

  return (
    <main className="bank">
      <header className="bank__header">
        <div>
          <Link className="bank__back" to="/">
            ← All projects
          </Link>
          <h1 className="bank__title">Atlassian question bank</h1>
          <p className="bank__subtitle">
            {b.total} reported questions across every round, each with the answer and where it was reported.
            Questions with a project link are built in this app.
          </p>
        </div>
        <input
          className="bank__search"
          type="search"
          placeholder="Search questions, answers, sources…"
          aria-label="Search questions"
          value={b.query}
          onChange={(event) => b.setQuery(event.target.value)}
        />
      </header>

      <div className="bank__tabs" role="group" aria-label="Filter by round">
        <button
          type="button"
          className={`bank__tab ${b.round === 'all' ? 'is-on' : ''}`}
          aria-pressed={b.round === 'all'}
          onClick={() => b.setRound('all')}
        >
          All <span className="bank__count">{b.matching}</span>
        </button>
        {ROUNDS.map((round) => (
          <button
            key={round}
            type="button"
            className={`bank__tab ${b.round === round ? 'is-on' : ''}`}
            aria-pressed={b.round === round}
            onClick={() => b.setRound(round)}
          >
            {ROUND_LABELS[round]} <span className="bank__count">{b.counts[round] ?? 0}</span>
          </button>
        ))}
      </div>

      {b.visible.length === 0 ? (
        <p className="bank__empty">Nothing matches “{b.query}”.</p>
      ) : (
        <ol className="bank__list">
          {b.visible.map((question) => {
            const project = question.projectId ? findProject(question.projectId) : undefined;
            return (
              <li key={question.id} className="bank__item">
                <div className="bank__meta">
                  <span className="bank__round">{ROUND_LABELS[question.round]}</span>
                  <span className={`bank__freq bank__freq--${question.frequency}`}>
                    {FREQUENCY_LABELS[question.frequency]}
                  </span>
                </div>

                <p className="bank__prompt">{question.prompt}</p>
                <p className="bank__answer">{question.answer}</p>

                <div className="bank__foot">
                  <span className="bank__sources">Reported: {question.sources.join(' · ')}</span>
                  {project && (
                    <Link className="bank__project" to={`/projects/${project.id}`}>
                      Built here: {project.title} →
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
