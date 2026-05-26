import { useState, useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTheme } from "../../contexts/ThemeContext";
import "./style.css";
import { asset } from "@/assets";

const NAV_LINKS = [
  { to: "/", label: "> HOME", key: "home" },
  { to: "/about", label: "> ABOUT", key: "about" },
  { to: "/contact", label: "> CONTACT", key: "contact" },
];

export function Navbar() {
  const { isDark, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);

  // Detect scroll to add backdrop blur
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  // Close menu on outside click
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  return (
    <header
      className={`navbar ${scrolled ? "navbar--scrolled" : ""}`}
      role="banner"
    >
      <nav className="navbar__inner container" ref={menuRef}>
        {/* Logo / brand */}
        <NavLink to="/" className="navbar__logo" aria-label="Go to home">
          <span className="navbar__logo-bracket">[</span>
          <span className="navbar__logo-name">CJ</span>
          <span className="navbar__logo-bracket">]</span>
          <span className="navbar__logo-cursor" aria-hidden="true" />
        </NavLink>

        {/* Desktop nav links */}
        <ul className="navbar__links" role="list">
          {NAV_LINKS.map(({ to, label, key }) => (
            <li key={key}>
              <NavLink
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `navbar__link ${isActive ? "navbar__link--active" : ""}`
                }
              >
                {label}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Right side: resume download + theme toggle + mobile burger */}
        <div className="navbar__controls">
          <a
            href={asset("/resume.pdf")}
            download="ChitranshJoshi-Resume.pdf"
            className="navbar__resume pixel-text"
            aria-label="Download resume"
          >
            ↓ CV
          </a>
          <ThemeToggleButton isDark={isDark} onToggle={toggleTheme} />

          {/* Mobile hamburger */}
          <button
            className={`navbar__burger ${menuOpen ? "navbar__burger--open" : ""}`}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        {/* Mobile dropdown */}
        <div
          className={`navbar__mobile-menu ${menuOpen ? "navbar__mobile-menu--open" : ""}`}
        >
          <ul role="list">
            {NAV_LINKS.map(({ to, label, key }) => (
              <li key={key}>
                <NavLink
                  to={to}
                  end={to === "/"}
                  className={({ isActive }) =>
                    `navbar__link ${isActive ? "navbar__link--active" : ""}`
                  }
                >
                  {label}
                </NavLink>
              </li>
            ))}
            <li>
              <a
                href={asset("/resume.pdf")}
                download="ChitranshJoshi-Resume.pdf"
                className="navbar__link navbar__link--resume pixel-text"
              >
                ↓ RESUME
              </a>
            </li>
          </ul>
        </div>
      </nav>
    </header>
  );
}

/* ── Theme Toggle Button ─────────────────────────────────── */
function ThemeToggleButton({
  isDark,
  onToggle,
}: {
  isDark: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className="theme-toggle"
      onClick={onToggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      <span className="theme-toggle__track" aria-hidden="true">
        {/* Pixel sun / moon icons rendered with CSS + spans */}
        <span className="theme-toggle__icon theme-toggle__icon--sun">☀</span>
        <span className="theme-toggle__icon theme-toggle__icon--moon">☽</span>
        <span
          className={`theme-toggle__thumb ${isDark ? "theme-toggle__thumb--dark" : ""}`}
        />
      </span>
      <span className="theme-toggle__label">{isDark ? "DARK" : "LITE"}</span>
    </button>
  );
}
