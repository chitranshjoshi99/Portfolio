import { useRef } from 'react';
import { SuggestionList } from './components/suggestion-list';
import { MESSAGE, MIN_QUERY_LENGTH } from './constants/typeahead.constants';
import { useClickOutside } from './hooks/use-click-outside';
import { useTypeahead } from './hooks/use-typeahead';
import './typeahead-search.css';

export default function TypeaheadSearchPage() {
  const typeahead = useTypeahead();
  const rootRef = useRef<HTMLDivElement>(null);

  useClickOutside(rootRef, typeahead.close);

  const isListVisible = typeahead.isOpen && typeahead.query.trim().length >= MIN_QUERY_LENGTH;

  return (
    <section className="ta">
      <div className="ta__combo" ref={rootRef}>
        <input
          className="ta__input"
          type="text"
          role="combobox"
          aria-expanded={isListVisible}
          aria-controls={typeahead.listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            typeahead.activeIndex >= 0 ? typeahead.getOptionId(typeahead.activeIndex) : undefined
          }
          aria-label="Search cities"
          autoComplete="off"
          placeholder="Search a city…"
          value={typeahead.query}
          onChange={(event) => typeahead.changeQuery(event.target.value)}
          onKeyDown={typeahead.handleKeyDown}
          onFocus={typeahead.open}
        />

        {typeahead.query && (
          <button type="button" className="ta__clear" aria-label="Clear search" onClick={typeahead.clear}>
            ✕
          </button>
        )}

        {isListVisible && (
          <SuggestionList
            id={typeahead.listboxId}
            suggestions={typeahead.suggestions}
            query={typeahead.query}
            activeIndex={typeahead.activeIndex}
            isLoading={typeahead.isLoading}
            error={typeahead.error}
            getOptionId={typeahead.getOptionId}
            onHover={typeahead.setActiveIndex}
            onSelect={typeahead.select}
          />
        )}
      </div>

      <p className="ta__hint">{typeahead.isTooShort ? MESSAGE.hint : ' '}</p>

      {typeahead.selected && (
        <div className="ta__selected">
          <strong>{typeahead.selected.name}</strong>
          <span>{typeahead.selected.country}</span>
          <span className="ta__selected-pop">{typeahead.selected.population.toLocaleString()} people</span>
        </div>
      )}

      <p className="ta__stats">
        {typeahead.requestCount} request{typeahead.requestCount === 1 ? '' : 's'} sent ·{' '}
        {typeahead.cacheSize} quer{typeahead.cacheSize === 1 ? 'y' : 'ies'} cached
      </p>
    </section>
  );
}
