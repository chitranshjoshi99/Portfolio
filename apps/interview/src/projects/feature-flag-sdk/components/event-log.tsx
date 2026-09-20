import { EVENT_LABEL } from '../constants/feature-flag-sdk.constants';
import type { FlagEvent } from '../feature-flag-sdk.types';

interface EventLogProps {
  events: FlagEvent[];
}

export function EventLog({ events }: EventLogProps) {
  if (events.length === 0) return <p className="ff__muted">No SDK activity yet.</p>;
  return (
    <ol className="ff__log" aria-label="SDK events, newest first">
      {events.map((event, index) => (
        <li key={`${event.at}-${index}`} className={`ff__event ff__event--${event.type}`}>
          <time>{new Date(event.at).toLocaleTimeString()}</time>
          <strong>{EVENT_LABEL[event.type]}</strong>
          <span>{event.detail}</span>
        </li>
      ))}
    </ol>
  );
}
