import type { FlagSnapshot } from '../feature-flag-sdk.types';
import type { ServerView } from '../hooks/use-flag-playground';

interface FlagTableProps {
  snapshot: FlagSnapshot;
  server: ServerView;
  onToggleServer: (name: string) => void;
  onOverride: (name: string, value: boolean | null) => void;
}

const OVERRIDE_CHOICES: { label: string; value: boolean | null }[] = [
  { label: 'server', value: null },
  { label: 'on', value: true },
  { label: 'off', value: false },
];

const onOff = (value: boolean | undefined) => (value === undefined ? '—' : value ? 'on' : 'off');

export function FlagTable({ snapshot, server, onToggleServer, onOverride }: FlagTableProps) {
  const names = Object.keys(server.flags);

  return (
    <table className="ff__table">
      <thead>
        <tr>
          <th scope="col">Flag</th>
          <th scope="col">Server now</th>
          <th scope="col">Client cache</th>
          <th scope="col">Dev override</th>
          <th scope="col">Effective</th>
        </tr>
      </thead>
      <tbody>
        {names.map((name) => {
          const cached = snapshot.flags?.[name];
          const override = name in snapshot.overrides ? snapshot.overrides[name] : null;
          const effective = override ?? cached;
          const isBehind = cached !== undefined && cached !== server.flags[name];
          return (
            <tr key={name}>
              <th scope="row">
                <code>{name}</code>
              </th>
              <td>
                <button
                  type="button"
                  className={`ff__pill ${server.flags[name] ? 'is-on' : ''}`}
                  aria-pressed={server.flags[name]}
                  onClick={() => onToggleServer(name)}
                >
                  {onOff(server.flags[name])}
                </button>
              </td>
              <td className={isBehind ? 'ff__behind' : undefined}>
                {onOff(cached)}
                {isBehind && <span className="ff__note"> stale</span>}
              </td>
              <td>
                <div className="ff__segment" role="radiogroup" aria-label={`Override ${name}`}>
                  {OVERRIDE_CHOICES.map((choice) => (
                    <button
                      key={choice.label}
                      type="button"
                      role="radio"
                      aria-checked={override === choice.value}
                      className={override === choice.value ? 'is-selected' : undefined}
                      onClick={() => onOverride(name, choice.value)}
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
              </td>
              <td className={effective ? 'ff__on' : 'ff__off'}>{onOff(effective)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
