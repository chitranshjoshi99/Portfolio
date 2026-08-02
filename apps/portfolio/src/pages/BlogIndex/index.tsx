import { Link } from "react-router-dom";
import { BLOGS } from "../../blogs/meta";
import "./style.css";

export default function BlogIndex() {
  return (
    <main className="blog-index" id="main-content">
      <div className="blog-index__inner">
        <p className="pixel-text blog-index__boot">$ cat ~/blog/posts/*</p>
        <h1 className="pixel-text blog-index__title">BLOGS.exe</h1>
        <p className="vt-text blog-index__sub">
          engineering notes &amp; live proof-of-concepts
        </p>

        <ul className="blog-index__list" role="list">
          {BLOGS.map((b) => (
            <li key={b.slug}>
              <Link to={`/blogs/${b.slug}`} className="blog-index__card">
                <span
                  className="pixel-text blog-index__card-tag"
                  style={{ color: b.accent }}
                >
                  {b.tag}
                </span>
                <span className="pixel-text blog-index__card-title">
                  {b.title}
                </span>
                <span className="vt-text blog-index__card-desc">
                  {b.description}
                </span>
                <span className="pixel-text blog-index__card-meta">
                  {b.date} · READ →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
