import { useJsRound } from './hooks/use-js-round';
import './js-round.css';

export default function JsRoundPage() {
  const j = useJsRound();

  return (
    <section className="jr">
      <nav className="jr__list" aria-label="Utilities">
        {j.demos.map((demo) => (
          <button
            key={demo.id}
            type="button"
            className={`jr__item ${demo.id === j.selectedId ? 'is-selected' : ''}`}
            aria-current={demo.id === j.selectedId ? 'true' : undefined}
            onClick={() => j.select(demo.id)}
          >
            {demo.title}
          </button>
        ))}
      </nav>

      <div className="jr__detail">
        <h2 className="jr__title">{j.demo.title}</h2>
        <p className="jr__prompt">{j.demo.prompt}</p>
        <p className="jr__reported">Reported: {j.demo.reported}</p>
        <button type="button" className="jr__run" onClick={() => void j.run()} disabled={j.running}>
          {j.running ? 'Running…' : '▶ Run'}
        </button>
        <pre className="jr__console" aria-live="polite">
          {j.lines.length ? j.lines.join('\n') : '// output appears here — the JS round is graded on logged output'}
        </pre>
      </div>
    </section>
  );
}
