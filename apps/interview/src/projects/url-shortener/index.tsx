import { LinkRow } from './components/link-row';
import { ResolvePanel } from './components/resolve-panel';
import { ShortenForm } from './components/shorten-form';
import { useResolver } from './hooks/use-resolver';
import { useShortLinks } from './hooks/use-short-links';
import './url-shortener.css';

export default function UrlShortenerPage() {
  const shortener = useShortLinks();
  const resolver = useResolver(shortener.resolve, shortener.visit);

  return (
    <section className="us">
      <ShortenForm
        url={shortener.url}
        onUrlChange={shortener.setUrl}
        alias={shortener.alias}
        onAliasChange={shortener.setAlias}
        error={shortener.error}
        onSubmit={shortener.submit}
      />

      <p className="us__stats">
        {shortener.links.length} link{shortener.links.length === 1 ? '' : 's'} · {shortener.totalClicks} total
        click{shortener.totalClicks === 1 ? '' : 's'} · saved in this browser
      </p>

      {shortener.links.length === 0 ? (
        <p className="us__empty">Nothing shortened yet.</p>
      ) : (
        <ul className="us__list">
          {shortener.links.map((link) => (
            <LinkRow
              key={link.code}
              link={link}
              shortUrl={shortener.shortUrl(link.code)}
              isCopied={shortener.copiedCode === link.code}
              isNew={shortener.lastCreatedCode === link.code}
              onCopy={() => shortener.copy(link.code)}
              onVisit={() => shortener.visit(link.code)}
              onRemove={() => shortener.remove(link.code)}
            />
          ))}
        </ul>
      )}

      <ResolvePanel
        input={resolver.input}
        onInputChange={resolver.setInput}
        result={resolver.result}
        onLookup={resolver.lookup}
      />
    </section>
  );
}
