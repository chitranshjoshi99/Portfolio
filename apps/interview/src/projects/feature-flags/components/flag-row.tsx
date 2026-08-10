import { ENV_LABEL, MESSAGE, STATE_LABEL } from '../constants/feature-flags.constants';
import type { Environment, FeatureFlag, Role } from '../feature-flags.types';
import { flagState } from '../utils/rollout.utils';
import { RolloutControl } from './rollout-control';

interface FlagRowProps {
  flag: FeatureFlag;
  environment: Environment;
  /** Selected rows drive the audience preview below the list. */
  isSelected: boolean;
  isPending: boolean;
  error: string | undefined;
  canToggle: boolean;
  canRollout: boolean;
  canArchive: boolean;
  exposed: number;
  audienceSize: number;
  onSelect: () => void;
  onPercentageChange: (percentage: number) => void;
  onToggleRole: (role: Role) => void;
  onArchivedChange: (archived: boolean) => void;
  onDismissError: () => void;
}

export function FlagRow({
  flag,
  environment,
  isSelected,
  isPending,
  error,
  canToggle,
  canRollout,
  canArchive,
  exposed,
  audienceSize,
  onSelect,
  onPercentageChange,
  onToggleRole,
  onArchivedChange,
  onDismissError,
}: FlagRowProps) {
  const state = flagState(flag, environment);
  const rule = flag.rules[environment];
  const isOn = state === 'on';

  return (
    <li className={`ff__row${isSelected ? ' ff__row--selected' : ''}${isPending ? ' ff__row--pending' : ''}`}>
      <div className="ff__row-head">
        <button type="button" className="ff__row-select" aria-pressed={isSelected} onClick={onSelect}>
          <span className="ff__key">{flag.key}</span>
          <span className="ff__name">{flag.name}</span>
        </button>

        <span className={`badge ff__state ff__state--${state}`}>{STATE_LABEL[state]}</span>
        {flag.archived && <span className="tag">archived</span>}

        <span className="ff__exposure">
          {exposed}/{audienceSize} sample users
        </span>
      </div>

      <p className="ff__description">{flag.description}</p>
      <p className="ff__meta">
        owner {flag.owner} · updated {flag.updatedAt} · rules shown for {ENV_LABEL[environment]}
      </p>

      <RolloutControl
        rule={rule}
        canEdit={canRollout}
        disabled={flag.archived || isPending}
        onPercentageChange={onPercentageChange}
        onToggleRole={onToggleRole}
      />

      <div className="ff__row-actions">
        <button
          type="button"
          className="ff__btn"
          disabled={!canToggle || flag.archived || isPending}
          title={canToggle ? undefined : MESSAGE.noPermission('toggle', environment)}
          onClick={() => onPercentageChange(isOn ? 0 : 100)}
        >
          {isOn ? 'Turn off' : 'Turn on for everyone'}
        </button>

        <button
          type="button"
          className="ff__btn"
          disabled={!canArchive || isPending}
          title={canArchive ? undefined : MESSAGE.noPermission('archive', environment)}
          onClick={() => onArchivedChange(!flag.archived)}
        >
          {flag.archived ? 'Restore' : 'Archive'}
        </button>

        {isPending && <span className="ff__spinner" aria-label="Saving" />}
      </div>

      {error && (
        <p className="ff__row-error" role="alert">
          {error}
          <button type="button" className="ff__link" onClick={onDismissError}>
            Dismiss
          </button>
        </p>
      )}
    </li>
  );
}
