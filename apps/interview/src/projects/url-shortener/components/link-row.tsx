import type { ShortLink } from '../url-shortener.types';
import { truncateUrl } from '../utils/url-shortener.utils';

interface LinkRowProps {
  link: ShortLink;
  shortUrl: string;
  isCopied: boolean;
  isNew: boolean;
  onCopy: () => void;
  onVisit: () => void;
  onRemove: () => void;
}

export function LinkRow({ link, shortUrl, isCopied, isNew, onCopy, onVisit, onRemove }: LinkRowProps) {
  return (
    <li className={`us__row${isNew ? ' us__row--new' : ''}`}>
      <div className="us__row-main">
        <div className="us__row-head">
          {/* The long URL only ever reaches an href after passing the protocol allowlist. */}
          <a
            className="us__code"
            href={link.longUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onVisit}
          >
            {shortUrl}
          </a>
          {link.isCustom && <span className="us__tag">custom</span>}
        </div>
        <span className="us__long" title={link.longUrl}>
          {truncateUrl(link.longUrl)}
        </span>
      </div>

      <div className="us__row-meta">
        <span className="us__clicks">
          {link.clicks} click{link.clicks === 1 ? '' : 's'}
        </span>
        <button type="button" className="us__btn" onClick={onCopy}>
          {isCopied ? 'Copied ✓' : 'Copy'}
        </button>
        <button type="button" className="us__btn us__btn--danger" aria-label={`Delete ${shortUrl}`} onClick={onRemove}>
          Delete
        </button>
      </div>
    </li>
  );
}
