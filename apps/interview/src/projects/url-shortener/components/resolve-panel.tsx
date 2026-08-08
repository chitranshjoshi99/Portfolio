import type { ShortLink } from '../url-shortener.types';

interface ResolvePanelProps {
  input: string;
  onInputChange: (input: string) => void;
  result: ShortLink | null | undefined;
  onLookup: () => void;
}

/**
 * Stands in for the redirect a real service would do server-side: paste a short
 * code, get the destination, and count the visit.
 */
export function ResolvePanel({ input, onInputChange, result, onLookup }: ResolvePanelProps) {
  return (
    <div className="us__resolve">
      <form
        className="us__resolve-form"
        onSubmit={(event) => {
          event.preventDefault();
          onLookup();
        }}
      >
        <input
          className="us__input"
          value={input}
          placeholder="short.ly/abc or just abc"
          aria-label="Short code to resolve"
          onChange={(event) => onInputChange(event.target.value)}
        />
        <button type="submit" className="us__btn">
          Resolve
        </button>
      </form>

      {result === null && (
        <p className="us__resolve-out us__resolve-out--miss" role="alert">
          No link with that code.
        </p>
      )}
      {result && (
        <p className="us__resolve-out">
          →{' '}
          <a href={result.longUrl} target="_blank" rel="noopener noreferrer">
            {result.longUrl}
          </a>
        </p>
      )}
    </div>
  );
}
