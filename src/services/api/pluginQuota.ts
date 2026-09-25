import type {
  PluginQuotaBucket,
  PluginQuotaData,
  PluginQuotaGroup,
  PluginQuotaMetric,
  PluginQuotaSubscription,
} from '@/types';
import { isRecord } from '@/utils/helpers';
import { parseIsoToMs } from '@/utils/quota/resetInstants';
import { apiClient } from './client';

const readText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const readNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const parseSubscription = (value: unknown): PluginQuotaSubscription | null => {
  if (!isRecord(value)) return null;
  const plan = readText(value.plan);
  const tierName = readText(value.tierName ?? value.tier_name);
  const tierId = readText(value.tierId ?? value.tier_id);
  if (!plan && !tierName && !tierId) return null;
  return { plan: plan || null, tierName: tierName || null, tierId: tierId || null };
};

const parseBucket = (value: unknown, id: string): PluginQuotaBucket | null => {
  if (!isRecord(value)) return null;
  // A bucket without a numeric fraction has nothing to draw.
  const remainingFraction = readNumber(value.remainingFraction ?? value.remaining_fraction);
  if (remainingFraction === null) return null;
  const resetTime = readText(value.resetTime ?? value.reset_time);
  const description = readText(value.description);
  return {
    id,
    label: readText(value.window) || description,
    remainingFraction,
    ...(resetTime ? { resetTime, resetAtMs: parseIsoToMs(resetTime) } : {}),
    ...(description ? { description } : {}),
  };
};

const parseGroup = (value: unknown, index: number): PluginQuotaGroup | null => {
  if (!isRecord(value)) return null;
  const id = `plugin-${index}`;
  const buckets = asList(value.buckets)
    .map((bucket, bucketIndex) => parseBucket(bucket, `${id}-${bucketIndex}`))
    .filter((bucket): bucket is PluginQuotaBucket => bucket !== null);
  if (buckets.length === 0) return null;
  return { id, label: readText(value.displayName ?? value.display_name), buckets };
};

const parseMetric = (value: unknown): PluginQuotaMetric | null => {
  if (!isRecord(value)) return null;
  const key = readText(value.key);
  const label = readText(value.label);
  const metricValue =
    typeof value.value === 'number' && Number.isFinite(value.value) ? value.value : null;
  if (!key || !label || metricValue === null) return null;
  const unit = readText(value.unit);
  const currency = readText(value.currency).toUpperCase();
  const isMoney = readText(value.format) === 'currency' && /^[A-Z]{3}$/.test(currency);
  return {
    key,
    label,
    value: metricValue,
    ...(unit ? { unit } : {}),
    format: isMoney ? 'currency' : 'number',
    ...(isMoney ? { currency } : {}),
  };
};

/**
 * Keep only the fields the quota UI renders. A plugin owns this payload, so
 * anything malformed is dropped per item rather than failing the whole card;
 * a body that is not an object at all returns null.
 */
export function parsePluginQuotaPayload(payload: unknown): PluginQuotaData | null {
  if (!isRecord(payload)) return null;
  return {
    subscription: parseSubscription(payload.subscription),
    groups: asList(payload.groups)
      .map(parseGroup)
      .filter((group): group is PluginQuotaGroup => group !== null),
    summary: asList(payload.summary)
      .map(parseMetric)
      .filter((metric): metric is PluginQuotaMetric => metric !== null),
    serverTimeOffsetMs: readNumber(payload.serverTimeOffsetMs ?? payload.server_time_offset_ms),
  };
}

export const pluginQuotaApi = {
  /** Ask CLIProxyAPI for one credential's quota through its plugin provider. */
  fetch: (authIndex: string) => apiClient.post<unknown>('/quota/fetch', { auth_index: authIndex }),
};
