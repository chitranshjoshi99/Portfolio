import { useState, useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTheme } from "../../contexts/ThemeContext";
import { haptics } from "../../utils/haptics";
import "./style.css";
import { asset } from "@/assets";

const NAV_LINKS = [
  { to: "/", label: "> HOME", key: "home" },
  { to: "/about", label: "> ABOUT", key: "about" },
  { to: "/labs", label: "> LABS", key: "labs" },
  { to: "/blogs", label: "> BLOGS", key: "blogs" },
  { to: "/contact", label: "> CONTACT", key: "contact" },
];

export function Navbar() {
  const { isDark, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // true when the hero avatar has scrolled out of the viewport
  const [avatarHidden, setAvatarHidden] = useState(false);
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);

  // Detect scroll to add backdrop blur
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close menu on route change; reset avatar badge on non-home routes
  useEffect(() => {
    setMenuOpen(false);
    if (location.pathname !== "/") setAvatarHidden(false);
  }, [location]);

  // Observe the hero avatar element (only present on the Home page).
  // When it exits the viewport → slide the mini avatar into the navbar logo.
  useEffect(() => {
    if (location.pathname !== "/") return;

    let obs: IntersectionObserver | null = null;

    const attach = () => {
      const target = document.getElementById("hero-avatar");
      if (!target) return false;
      obs = new IntersectionObserver(
        ([entry]) => setAvatarHidden(!entry.isIntersecting),
        { threshold: 0.1 },
      );
      obs.observe(target);
      return true;
    };

    // The element might not be in the DOM on first paint — retry once
    if (!attach()) {
      const t = setTimeout(attach, 120);
      return () => {
        clearTimeout(t);
        obs?.disconnect();
      };
    }

    return () => obs?.disconnect();
  }, [location.pathname]);

  // Close menu on outside click or Escape key
  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <header
      className={`navbar ${scrolled ? "navbar--scrolled" : ""}`}
      role="banner"
    >
      <nav className="navbar__inner container" ref={menuRef}>
        {/* Logo / brand */}
        <NavLink to="/" className="navbar__logo" aria-label="Go to home">
          {/* Mini avatar — slides in from behind the logo when hero avatar leaves view */}
          <span
            className={`navbar__mini-avatar ${avatarHidden ? "navbar__mini-avatar--visible" : ""}`}
            aria-hidden="true"
          >
            <img
              src={asset("/profile.jpeg")}
              alt=""
              className="navbar__mini-avatar-img"
            />
          </span>

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
                onClick={() => haptics.tap()}
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
            className="navbar__link navbar__link--active pixel-text"
            aria-label="Download resume"
            onClick={() => haptics.press()}
          >
            ↓ RESUME
          </a>
          <ThemeToggleButton
            isDark={isDark}
            onToggle={() => {
              haptics.toggle();
              toggleTheme();
            }}
          />

          {/* Mobile hamburger */}
          <button
            className={`navbar__burger ${menuOpen ? "navbar__burger--open" : ""}`}
            onClick={() => {
              haptics.tap();
              setMenuOpen((v) => !v);
            }}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="navbar-mobile-menu"
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        {/* Mobile dropdown */}
        <div
          id="navbar-mobile-menu"
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
                  onClick={() => haptics.tap()}
                >
                  {label}
                </NavLink>
              </li>
            ))}
            <li>
              <a
                href={asset("/resume.pdf")}
                download="ChitranshJoshi-Resume.pdf"
                className="navbar__link navbar__link--resume pixel-text "
                onClick={() => haptics.press()}
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
      <span className="theme-toggle__label">{isDark ? "DARK" : "LIGHT"}</span>
    </button>
  );
}
