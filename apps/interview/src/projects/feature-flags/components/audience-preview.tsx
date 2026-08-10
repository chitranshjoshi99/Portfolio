import { ENV_LABEL, REASON_LABEL, ROLE_LABEL } from '../constants/feature-flags.constants';
import type { Environment, FeatureFlag } from '../feature-flags.types';
import type { AudienceRow } from '../hooks/use-audience-preview';

interface AudiencePreviewProps {
  flag: FeatureFlag | null;
  environment: Environment;
  rows: AudienceRow[];
  enabledCount: number;
  canOverride: boolean;
  isPending: boolean;
  onOverrideChange: (userId: string, value: boolean | null) => void;
}

export function AudiencePreview({
  flag,
  environment,
  rows,
  enabledCount,
  canOverride,
  isPending,
  onOverrideChange,
}: AudiencePreviewProps) {
  if (!flag) return null;

  return (
    <section className="ff__audience" aria-label="Who sees this flag">
      <header className="ff__audience-head">
        <h2 className="ff__audience-title">
          Who sees <code>{flag.key}</code> in {ENV_LABEL[environment]}
        </h2>
        <span className="ff__count">
          {enabledCount} of {rows.length} sample users
        </span>
      </header>

      <ul className="ff__audience-list">
        {rows.map(({ user, evaluation, override }) => (
          <li key={user.id} className={`ff__user${evaluation.enabled ? ' ff__user--on' : ''}`}>
            <span className="ff__user-dot" aria-hidden="true" />
            <span className="ff__user-name">{user.name}</span>
            <span className="ff__user-role">{ROLE_LABEL[user.role]}</span>

            <span className="ff__user-reason">
              {evaluation.enabled ? 'on' : 'off'} — {REASON_LABEL[evaluation.reason]}
              {evaluation.reason === 'bucket' && ` ${evaluation.bucket}`}
            </span>

            <span className="ff__user-actions">
              <button
                type="button"
                className={`ff__step${override === true ? ' ff__step--active' : ''}`}
                disabled={!canOverride || isPending}
                onClick={() => onOverrideChange(user.id, override === true ? null : true)}
              >
                Force on
              </button>
              <button
                type="button"
                className={`ff__step${override === false ? ' ff__step--active' : ''}`}
                disabled={!canOverride || isPending}
                onClick={() => onOverrideChange(user.id, override === false ? null : false)}
              >
                Force off
              </button>
            </span>
          </li>
        ))}
      </ul>

      <p className="ff__hint">
        Bucket is <code>hash(flagKey + userId) % 100</code> — the same user lands in the same bucket on
        every reload, and on the server.
      </p>
    </section>
  );
}
