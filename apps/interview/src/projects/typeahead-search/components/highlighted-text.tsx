import { splitHighlight } from '../utils/typeahead.utils';

interface HighlightedTextProps {
  text: string;
  query: string;
}

/** Renders segments as elements — never builds an HTML string out of user input. */
export function HighlightedText({ text, query }: HighlightedTextProps) {
  return (
    <>
      {splitHighlight(text, query).map((segment, index) =>
        segment.isMatch ? (
          <mark key={index} className="ta__mark">
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}
