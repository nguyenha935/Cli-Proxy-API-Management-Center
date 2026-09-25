/**
 * Plugin quota data layer. React-free / SCSS-free.
 *
 * One adapter serves every provider whose quota comes from a CLIProxyAPI
 * plugin: the server marks those auth files with `supports_quota` and answers
 * POST /quota/fetch in one normalized shape, so no provider-specific code is
 * needed here.
 */

import type { TFunction } from 'i18next';
import type { AuthFileItem, PluginQuotaData, PluginQuotaState } from '@/types';
import { parsePluginQuotaPayload, pluginQuotaApi } from '@/services/api/pluginQuota';
import { normalizeAuthIndex } from '@/utils/authIndex';
import { isDisabledAuthFile, resolveAuthProvider } from '@/utils/quota';
import { QUOTA_TAB_ORDER } from '../../constants';
import type { QuotaProviderData } from '../types';

/** Providers the panel reads quota for itself keep their own adapter. */
const BUILT_IN_PROVIDERS = new Set<string>(QUOTA_TAB_ORDER.filter((type) => type !== 'plugin'));

const readFlag = (value: unknown): boolean =>
  value === true || (typeof value === 'string' && value.trim().toLowerCase() === 'true');

/** True for an auth file whose quota CLIProxyAPI serves through a plugin. */
export const isPluginQuotaFile = (file: AuthFileItem): boolean =>
  readFlag(file['supports_quota']) && !BUILT_IN_PROVIDERS.has(resolveAuthProvider(file));

const fetchPluginQuota = async (file: AuthFileItem, t: TFunction): Promise<PluginQuotaData> => {
  const authIndex = normalizeAuthIndex(file['auth_index'] ?? file.authIndex);
  if (!authIndex) {
    throw new Error(t('plugin_quota.missing_auth_index'));
  }
  const data = parsePluginQuotaPayload(await pluginQuotaApi.fetch(authIndex));
  if (!data) {
    throw new Error(t('plugin_quota.empty_data'));
  }
  return data;
};

export const PLUGIN_CONFIG: QuotaProviderData<PluginQuotaState, PluginQuotaData> = {
  type: 'plugin',
  i18nPrefix: 'plugin_quota',
  filterFn: (file) => isPluginQuotaFile(file) && !isDisabledAuthFile(file),
  fetchQuota: fetchPluginQuota,
  storeSelector: (state) => state.pluginQuota,
  storeSetter: 'setPluginQuota',
  buildLoadingState: () => ({ status: 'loading', groups: [] }),
  buildSuccessState: (data) => ({ status: 'success', ...data }),
  buildErrorState: (message, status) => ({
    status: 'error',
    groups: [],
    error: message,
    errorStatus: status,
  }),
};
