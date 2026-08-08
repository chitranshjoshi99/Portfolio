import { SHORT_ORIGIN } from '../constants/url-shortener.constants';
import type { FormError } from '../url-shortener.types';

interface ShortenFormProps {
  url: string;
  onUrlChange: (url: string) => void;
  alias: string;
  onAliasChange: (alias: string) => void;
  error: FormError | null;
  onSubmit: () => void;
}

export function ShortenForm({ url, onUrlChange, alias, onAliasChange, error, onSubmit }: ShortenFormProps) {
  return (
    <form
      className="us__form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      noValidate
    >
      <div className="us__field">
        <input
          className={`us__input${error?.field === 'url' ? ' us__input--invalid' : ''}`}
          value={url}
          placeholder="https://example.com/a/very/long/path"
          aria-label="Long URL"
          aria-invalid={error?.field === 'url'}
          onChange={(event) => onUrlChange(event.target.value)}
        />
      </div>

      <div className="us__field us__field--alias">
        <span className="us__prefix">{SHORT_ORIGIN}/</span>
        <input
          className={`us__input us__input--alias${error?.field === 'alias' ? ' us__input--invalid' : ''}`}
          value={alias}
          placeholder="custom-alias (optional)"
          aria-label="Custom alias, optional"
          aria-invalid={error?.field === 'alias'}
          onChange={(event) => onAliasChange(event.target.value)}
        />
      </div>

      <button type="submit" className="us__btn us__btn--primary">
        Shorten
      </button>

      {error && (
        <p className="us__error" role="alert">
          {error.message}
        </p>
      )}
    </form>
  );
}
