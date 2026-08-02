import { PUBLISHED_APPS } from "../../data/apps";
import "./style.css";

export default function Apps() {
  return (
    <main className="apps-index" id="main-content">
      <div className="apps-index__inner">
        <p className="pixel-text apps-index__boot">$ ls ~/apps --published</p>
        <h1 className="pixel-text apps-index__title">APPS.exe</h1>
        <p className="vt-text apps-index__sub">
          Small, focused tools and experiments built by Chitransh.
        </p>

        <ul className="apps-index__grid" role="list">
          {PUBLISHED_APPS.map((app) => (
            <li key={app.slug}>
              <a className="apps-index__card" href={`/apps/${app.slug}/`}>
                <span
                  className="pixel-text apps-index__card-label"
                  style={{ color: app.accent }}
                >
                  {app.label}
                </span>
                <span className="pixel-text apps-index__card-title">
                  {app.name}
                </span>
                <span className="vt-text apps-index__card-desc">
                  {app.description}
                </span>
                <span className="pixel-text apps-index__card-open">
                  LAUNCH APP →
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
