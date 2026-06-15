import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Link, useParams } from "react-router-dom";
import { getBlog, ogImageUrl } from "../../blogs/meta";
import { loadBlogBody } from "../../blogs/content";
import { useDocumentMeta } from "../../hooks/useDocumentMeta";
import { SITE_URL } from "../../config/site";
import "./style.css";

export default function BlogPost() {
  const { slug = "" } = useParams();
  const blog = getBlog(slug);
  const [Body, setBody] = useState<ComponentType | null>(null);

  useEffect(() => {
    let alive = true;
    setBody(null);
    loadBlogBody(slug)?.then((m) => {
      if (alive) setBody(() => m.default);
    });
    return () => {
      alive = false;
    };
  }, [slug]);

  const meta = useMemo(
    () =>
      blog
        ? {
            title: blog.title,
            description: blog.description,
            url: `${SITE_URL}/blogs/${blog.slug}`,
            image: ogImageUrl(SITE_URL, blog),
          }
        : null,
    [blog],
  );
  useDocumentMeta(meta);

  if (!blog) {
    return (
      <main className="blog-post" id="main-content">
        <div className="blog-post__inner">
          <p className="pixel-text">404 — post not found.</p>
          <Link to="/blogs" className="blog-post__back pixel-text">
            ← ALL POSTS
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="blog-post" id="main-content">
      <article className="blog-post__inner">
        <Link to="/labs" className="blog-post__back pixel-text">
          ← BACK TO LABS
        </Link>
        <p className="pixel-text blog-post__tag" style={{ color: blog.accent }}>
          {blog.tag}
        </p>
        <h1 className="pixel-text blog-post__title">{blog.title}</h1>
        <p className="pixel-text blog-post__date">{blog.date}</p>
        <div className="blog-prose vt-text">
          {Body ? (
            <Body />
          ) : (
            <p className="pixel-text blog-post__loading">loading…</p>
          )}
        </div>
      </article>
    </main>
  );
}
