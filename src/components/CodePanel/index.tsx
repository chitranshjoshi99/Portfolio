import "./style.css";

interface Props {
  code: string;
  filename: string;
}

export function CodePanel({ code, filename }: Props) {
  const lines = code.split("\n");

  return (
    <div className="code-panel">
      <div className="code-panel__titlebar">
        <div className="code-panel__dots" aria-hidden="true">
          <span className="code-panel__dot code-panel__dot--red" />
          <span className="code-panel__dot code-panel__dot--yellow" />
          <span className="code-panel__dot code-panel__dot--green" />
        </div>
        <span className="pixel-text code-panel__filename">{filename}</span>
      </div>
      <pre
        className="code-panel__body vt-text"
        aria-label={`Code snippet: ${filename}`}
      >
        {lines.map((line, i) => (
          <div key={i} className="code-panel__line">
            <span className="code-panel__ln" aria-hidden="true">
              {String(i + 1).padStart(2, " ")}
            </span>
            <span>{line}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}
