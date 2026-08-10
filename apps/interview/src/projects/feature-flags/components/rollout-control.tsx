import { ROLES, ROLE_LABEL, ROLLOUT_STEPS } from '../constants/feature-flags.constants';
import type { FlagRule, Role } from '../feature-flags.types';

interface RolloutControlProps {
  rule: FlagRule;
  /** False when the acting role has no rollout grant here — the controls render disabled. */
  canEdit: boolean;
  disabled: boolean;
  onPercentageChange: (percentage: number) => void;
  onToggleRole: (role: Role) => void;
}

/**
 * Discrete steps rather than a drag slider, on purpose: a controlled `<input type="range">` fires
 * on every intermediate value, so one drag from 0 to 50 would fire fifty writes. Committing on
 * release means holding the drag position in local state, which is more machinery than a rollout
 * dial is worth — real consoles ship presets for the same reason.
 */
export function RolloutControl({
  rule,
  canEdit,
  disabled,
  onPercentageChange,
  onToggleRole,
}: RolloutControlProps) {
  const isLocked = !canEdit || disabled;

  return (
    <div className="ff__rollout">
      <div className="ff__bar" aria-hidden="true">
        <span className="ff__bar-fill" style={{ width: `${rule.percentage}%` }} />
      </div>

      <div className="ff__steps" role="group" aria-label="Rollout percentage">
        {ROLLOUT_STEPS.map((step) => (
          <button
            key={step}
            type="button"
            className={`ff__step${step === rule.percentage ? ' ff__step--active' : ''}`}
            aria-pressed={step === rule.percentage}
            disabled={isLocked}
            onClick={() => onPercentageChange(step)}
          >
            {step}%
          </button>
        ))}
        <span className="ff__percent">{rule.percentage}% of everyone else</span>
      </div>

      <div className="ff__targets" role="group" aria-label="Always on for roles">
        <span className="ff__targets-label">Always on for</span>
        {ROLES.map((role) => (
          <button
            key={role}
            type="button"
            className={`ff__chip ff__chip--sm${rule.roles.includes(role) ? ' ff__chip--active' : ''}`}
            aria-pressed={rule.roles.includes(role)}
            disabled={isLocked}
            onClick={() => onToggleRole(role)}
          >
            {ROLE_LABEL[role]}
          </button>
        ))}
      </div>
    </div>
  );
}
