import { AudiencePreview } from './components/audience-preview';
import { DemoControls } from './components/demo-controls';
import { FlagRow } from './components/flag-row';
import { FlagToolbar } from './components/flag-toolbar';
import { RoleSwitcher } from './components/role-switcher';
import { ENVIRONMENTS, MESSAGE } from './constants/feature-flags.constants';
import { AUDIENCE } from './constants/flag-seed';
import type { FlagAction } from './feature-flags.types';
import { useAudiencePreview } from './hooks/use-audience-preview';
import { useFlagConsole } from './hooks/use-flag-console';
import { grantedActions, writableEnvironments } from './utils/rbac.utils';
import { exposure } from './utils/rollout.utils';
import './feature-flags.css';

const ACTIONS: FlagAction[] = ['view', 'toggle', 'rollout', 'archive'];

export default function FeatureFlagsPage() {
  const flagConsole = useFlagConsole();
  const preview = useAudiencePreview(flagConsole.allFlags, flagConsole.environment);

  // The bypass switch only changes what renders enabled. Every one of these calls has a twin on
  // the server, and that twin has no bypass.
  const allows = (action: FlagAction) => flagConsole.bypassClientChecks || flagConsole.allows(action);

  return (
    <section className="ff">
      <RoleSwitcher
        role={flagConsole.role}
        onRoleChange={flagConsole.setRole}
        environment={flagConsole.environment}
        onEnvironmentChange={flagConsole.setEnvironment}
        granted={grantedActions(
          flagConsole.permissions,
          flagConsole.role,
          flagConsole.environment,
          ACTIONS,
        )}
        writable={writableEnvironments(flagConsole.permissions, flagConsole.role, ENVIRONMENTS)}
      />

      <DemoControls
        bypassClientChecks={flagConsole.bypassClientChecks}
        onToggleBypass={flagConsole.toggleBypass}
        onResetData={flagConsole.resetData}
      />

      <FlagToolbar
        search={flagConsole.search}
        onSearchChange={flagConsole.setSearch}
        stateFilter={flagConsole.stateFilter}
        onStateFilterChange={flagConsole.setStateFilter}
        total={flagConsole.flags.length}
        isLoading={flagConsole.isLoading}
      />

      {flagConsole.listError ? (
        <p className="ff__error" role="alert">
          {flagConsole.listError}
          <button type="button" className="ff__link" onClick={flagConsole.reload}>
            Retry
          </button>
        </p>
      ) : flagConsole.flags.length === 0 && !flagConsole.isLoading ? (
        <p className="ff__empty">{MESSAGE.empty}</p>
      ) : (
        <ul className={`ff__list${flagConsole.isLoading ? ' ff__list--stale' : ''}`}>
          {flagConsole.flags.map((flag) => (
            <FlagRow
              key={flag.key}
              flag={flag}
              environment={flagConsole.environment}
              isSelected={preview.selected?.key === flag.key}
              isPending={flagConsole.pendingKeys.has(flag.key)}
              error={flagConsole.errorByKey[flag.key]}
              canToggle={allows('toggle')}
              canRollout={allows('rollout')}
              canArchive={allows('archive')}
              exposed={exposure(flag, flagConsole.environment, AUDIENCE)}
              audienceSize={AUDIENCE.length}
              onSelect={() => preview.select(flag.key)}
              onPercentageChange={(percentage) => flagConsole.setPercentage(flag.key, percentage)}
              onToggleRole={(role) => flagConsole.toggleRoleTarget(flag.key, role)}
              onArchivedChange={(archived) => flagConsole.setArchived(flag.key, archived)}
              onDismissError={() => flagConsole.dismissError(flag.key)}
            />
          ))}
        </ul>
      )}

      <AudiencePreview
        flag={preview.selected}
        environment={flagConsole.environment}
        rows={preview.rows}
        enabledCount={preview.enabledCount}
        canOverride={allows('rollout')}
        isPending={preview.selected ? flagConsole.pendingKeys.has(preview.selected.key) : false}
        onOverrideChange={(userId, value) => {
          if (preview.selected) flagConsole.setOverride(preview.selected.key, userId, value);
        }}
      />
    </section>
  );
}
