interface GuideLinkProps {
  href: string;
  /** Project title — used to build the accessible name, since the icon reads as nothing. */
  title: string;
  className?: string;
}

/** "Open the published build guide" icon link. Shared by the listing card and the project page. */
export function GuideLink({ href, title, className }: GuideLinkProps) {
  return (
    <a
      className={className ? `guide-link ${className}` : 'guide-link'}
      href={href}
      target="_blank"
      // noreferrer as well as noopener: without it the opened page gets a handle on window.opener
      rel="noopener noreferrer"
      aria-label={`Open the ${title} build guide in a new tab`}
      title="Open build guide"
    >
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
        <path
          d="M14 4h6v6M20 4l-8.5 8.5M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
}
