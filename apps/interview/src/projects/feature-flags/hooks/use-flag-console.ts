import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MESSAGE, ROLES, ROLE_GRANTS } from '../constants/feature-flags.constants';
import type {
  Environment,
  FeatureFlag,
  FlagAction,
  FlagState,
  PermissionIndex,
  Role,
} from '../feature-flags.types';
import * as api from '../utils/flag-api';
import { buildPermissionIndex, can } from '../utils/rbac.utils';
import {
  filterFlags,
  patchFlag,
  withArchived,
  withOverride,
  withRoleTarget,
  withRule,
} from '../utils/rollout.utils';

export interface UseFlagConsole {
  /** Whose permissions the console is being viewed with. */
  role: Role;
  setRole: (role: Role) => void;
  environment: Environment;
  setEnvironment: (environment: Environment) => void;
  permissions: PermissionIndex;
  /** Already curried on the current role and environment — components ask one question. */
  allows: (action: FlagAction) => boolean;

  search: string;
  setSearch: (search: string) => void;
  stateFilter: FlagState | 'all';
  setStateFilter: (state: FlagState | 'all') => void;

  /** Filtered, for the list. */
  flags: FeatureFlag[];
  /** Unfiltered, so the audience preview keeps its selection when a filter hides the row. */
  allFlags: FeatureFlag[];
  isLoading: boolean;
  listError: string | null;
  reload: () => void;

  pendingKeys: Set<string>;
  errorByKey: Record<string, string>;
  dismissError: (key: string) => void;

  setPercentage: (key: string, percentage: number) => void;
  toggleRoleTarget: (key: string, role: Role) => void;
  setOverride: (key: string, userId: string, value: boolean | null) => void;
  setArchived: (key: string, archived: boolean) => void;

  /** Demo switch: render the controls enabled even where the role has no grant. */
  bypassClientChecks: boolean;
  toggleBypass: () => void;
  resetData: () => void;
}

const TODAY = () => new Date().toISOString().slice(0, 10);

export function useFlagConsole(): UseFlagConsole {
  const [role, setRole] = useState<Role>('developer');
  const [environment, setEnvironment] = useState<Environment>('prod');
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<FlagState | 'all'>('all');
  const [bypassClientChecks, setBypassClientChecks] = useState(false);

  const [allFlags, setAllFlags] = useState<FeatureFlag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [pendingKeys, setPendingKeys] = useState<Set<string>>(() => new Set());
  const [errorByKey, setErrorByKey] = useState<Record<string, string>>({});

  /** Only the newest list request may write to state — older ones are dropped on arrival. */
  const latestRequestId = useRef(0);

  // The grant table is static config, so the flattened index is built once per mount and never
  // rebuilt. Every `allows()` below is a Set lookup against it.
  const permissions = useMemo(() => buildPermissionIndex(ROLE_GRANTS, ROLES), []);

  useEffect(() => {
    const requestId = ++latestRequestId.current;
    setIsLoading(true);

    api
      .listFlags()
      .then((result) => {
        if (requestId !== latestRequestId.current) return;
        setAllFlags(result);
        setListError(null);
      })
      .catch(() => {
        if (requestId !== latestRequestId.current) return;
        setListError(MESSAGE.listFailed);
      })
      .finally(() => {
        if (requestId === latestRequestId.current) setIsLoading(false);
      });
  }, [reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const allows = useCallback(
    (action: FlagAction) => can(permissions, role, action, environment),
    [environment, permissions, role],
  );

  const dismissError = useCallback((key: string) => {
    setErrorByKey(({ [key]: _dropped, ...rest }) => rest);
  }, []);

  const togglePending = useCallback((key: string, isPending: boolean) => {
    setPendingKeys((current) => {
      const next = new Set(current);
      if (isPending) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  /**
   * Optimistic write. The row moves immediately, the server is asked, and on rejection the
   * previous flag is put back and the reason is parked on that row.
   *
   * A rejection here is usually a 403, not a network blip, so there is no retry button: retrying
   * the same request with the same role gets the same answer. The fix is a different role.
   */
  const mutate = useCallback(
    async (
      key: string,
      optimistic: (flag: FeatureFlag) => FeatureFlag,
      request: () => Promise<FeatureFlag>,
    ) => {
      const previous = allFlags.find((flag) => flag.key === key);
      if (!previous) return;

      setAllFlags((current) => patchFlag(current, key, optimistic));
      togglePending(key, true);
      dismissError(key);

      try {
        const saved = await request();
        // The server is the source of truth — take its row, not the guess.
        setAllFlags((current) => patchFlag(current, key, () => saved));
      } catch (error) {
        setAllFlags((current) => patchFlag(current, key, () => previous));
        setErrorByKey((current) => ({
          ...current,
          [key]: error instanceof api.ForbiddenError ? error.message : MESSAGE.mutationFailed,
        }));
      } finally {
        togglePending(key, false);
      }
    },
    [allFlags, dismissError, togglePending],
  );

  const setPercentage = useCallback(
    (key: string, percentage: number) => {
      void mutate(
        key,
        (flag) => withRule(flag, environment, { percentage }, TODAY()),
        () => api.setPercentage(role, environment, key, percentage),
      );
    },
    [environment, mutate, role],
  );

  const toggleRoleTarget = useCallback(
    (key: string, target: Role) => {
      void mutate(
        key,
        (flag) => withRoleTarget(flag, environment, target, TODAY()),
        () => api.toggleRoleTarget(role, environment, key, target),
      );
    },
    [environment, mutate, role],
  );

  const setOverride = useCallback(
    (key: string, userId: string, value: boolean | null) => {
      void mutate(
        key,
        (flag) => withOverride(flag, environment, userId, value, TODAY()),
        () => api.setOverride(role, environment, key, userId, value),
      );
    },
    [environment, mutate, role],
  );

  const setArchived = useCallback(
    (key: string, archived: boolean) => {
      void mutate(
        key,
        (flag) => withArchived(flag, archived, TODAY()),
        () => api.setArchived(role, environment, key, archived),
      );
    },
    [environment, mutate, role],
  );

  const resetData = useCallback(() => {
    api.resetFlagDb();
    setErrorByKey({});
    reload();
  }, [reload]);

  const flags = useMemo(
    () => filterFlags(allFlags, environment, search, stateFilter),
    [allFlags, environment, search, stateFilter],
  );

  return {
    role,
    setRole,
    environment,
    setEnvironment,
    permissions,
    allows,
    search,
    setSearch,
    stateFilter,
    setStateFilter,
    flags,
    allFlags,
    isLoading,
    listError,
    reload,
    pendingKeys,
    errorByKey,
    dismissError,
    setPercentage,
    toggleRoleTarget,
    setOverride,
    setArchived,
    bypassClientChecks,
    toggleBypass: () => setBypassClientChecks((current) => !current),
    resetData,
  };
}
