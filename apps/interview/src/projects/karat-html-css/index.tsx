import { TaskPreview } from './components/task-preview';
import { useCssTasks } from './hooks/use-css-tasks';
import './karat-html-css.css';

export default function KaratHtmlCssPage() {
  const k = useCssTasks();

  return (
    <section className="kc">
      <nav className="kc__list" aria-label="Tasks">
        {k.tasks.map((task) => (
          <button
            key={task.id}
            type="button"
            className={`kc__item ${task.id === k.selectedId ? 'is-selected' : ''}`}
            aria-current={task.id === k.selectedId ? 'true' : undefined}
            onClick={() => k.select(task.id)}
          >
            {task.title}
          </button>
        ))}
      </nav>

      <div className="kc__detail">
        <h2 className="kc__title">{k.task.title}</h2>
        <p className="kc__prompt">{k.task.prompt}</p>
        <p className="kc__reported">Reported: {k.task.reported}</p>

        <TaskPreview
          title={k.task.title}
          srcDoc={k.srcDoc}
          width={k.width}
          maxWidth={k.maxWidth}
          presets={k.task.widths}
          runKey={k.runKey}
          stageRef={k.stageRef}
          onWidth={k.setWidth}
          onReload={k.reload}
        />

        <div className="kc__cols">
          <div>
            <h3 className="kc__h3">What is being graded</h3>
            <ul className="kc__checks">
              {k.task.checks.map((check) => (
                <li key={check}>{check}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="kc__h3">Traps</h3>
            <ul className="kc__traps">
              {k.task.traps.map((trap) => (
                <li key={trap}>{trap}</li>
              ))}
            </ul>
          </div>
        </div>

        <details className="kc__source">
          <summary>Source — HTML</summary>
          <pre>{k.task.html}</pre>
        </details>
        <details className="kc__source">
          <summary>Source — CSS</summary>
          <pre>{k.task.css.trim()}</pre>
        </details>
        {k.task.js && (
          <details className="kc__source">
            <summary>Source — JS{k.task.needsValidator ? ' (plus the validator from utils)' : ''}</summary>
            <pre>{k.task.js.trim()}</pre>
          </details>
        )}
      </div>
    </section>
  );
}
