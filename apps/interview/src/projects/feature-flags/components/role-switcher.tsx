import {
  ACTION_LABEL,
  ENVIRONMENTS,
  ENV_LABEL,
  ROLES,
  ROLE_LABEL,
} from '../constants/feature-flags.constants';
import type { Environment, FlagAction, Role } from '../feature-flags.types';

interface RoleSwitcherProps {
  role: Role;
  onRoleChange: (role: Role) => void;
  environment: Environment;
  onEnvironmentChange: (environment: Environment) => void;
  /** Actions this role holds in the selected environment. */
  granted: FlagAction[];
  writable: Environment[];
}

const ALL_ACTIONS: FlagAction[] = ['view', 'toggle', 'rollout', 'archive'];

export function RoleSwitcher({
  role,
  onRoleChange,
  environment,
  onEnvironmentChange,
  granted,
  writable,
}: RoleSwitcherProps) {
  return (
    <div className="ff__switcher">
      <label className="ff__field">
        <span className="ff__field-label">Acting as</span>
        <select
          className="ff__select"
          value={role}
          onChange={(event) => onRoleChange(event.target.value as Role)}
        >
          {ROLES.map((option) => (
            <option key={option} value={option}>
              {ROLE_LABEL[option]}
            </option>
          ))}
        </select>
      </label>

      <div className="ff__envs" role="group" aria-label="Environment">
        {ENVIRONMENTS.map((option) => (
          <button
            key={option}
            type="button"
            className={`ff__chip${option === environment ? ' ff__chip--active' : ''}`}
            aria-pressed={option === environment}
            onClick={() => onEnvironmentChange(option)}
          >
            {ENV_LABEL[option]}
          </button>
        ))}
      </div>

      <ul className="ff__matrix" aria-label={`Permissions in ${ENV_LABEL[environment]}`}>
        {ALL_ACTIONS.map((action) => {
          const allowed = granted.includes(action);
          return (
            <li key={action} className={`ff__grant${allowed ? ' ff__grant--on' : ''}`}>
              <span aria-hidden="true">{allowed ? '✓' : '✕'}</span>
              {ACTION_LABEL[action]}
              <span className="ff__sr">{allowed ? 'allowed' : 'not allowed'}</span>
            </li>
          );
        })}
      </ul>

      <p className="ff__hint">
        {writable.length === 0
          ? 'Read-only in every environment.'
          : `Can change flags in ${writable.map((option) => ENV_LABEL[option]).join(', ')}.`}
      </p>
    </div>
  );
}
