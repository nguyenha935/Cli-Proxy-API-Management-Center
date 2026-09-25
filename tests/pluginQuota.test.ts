/**
 * Plugin quota: CLIProxyAPI's normalized QuotaFetchResponse for credentials a
 * plugin serves (supports_quota on the auth file, POST /quota/fetch).
 */

import { afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { TFunction } from 'i18next';
import i18n from '@/i18n';
import type { AuthFileItem, PluginQuotaState } from '@/types';
import { parsePluginQuotaPayload, pluginQuotaApi } from '@/services/api/pluginQuota';
import { PLUGIN_CONFIG, isPluginQuotaFile } from '@/features/quota/providers/plugin/data';
import { PluginQuotaBody } from '@/features/quota/providers/plugin/PluginQuotaBody';
import { QUOTA_CLASS_KEYS, bindQuotaClasses } from '@/features/quota/types';
import { classifyQuotaFiles } from '@/features/quota/logic';
import { collectQuotaRowInstants } from '@/features/quota/resetSchedule';
import { resolveAuthFileQuotaType } from '@/features/authFiles/logic';

const kiro: AuthFileItem = {
  name: 'kiro-a.json',
  provider: 'kiro',
  authIndex: 'idx-a',
  supports_quota: true,
  quota_provider: 'kiro',
};

// Shape the Kiro plugin returns (cmd/kiro-plugin/quota.go).
const payload = {
  subscription: { plan: 'KIRO FREE', tierId: 'Q_DEVELOPER_STANDALONE_FREE' },
  groups: [
    {
      displayName: 'Credits',
      buckets: [
        {
          window: 'Plan',
          remainingFraction: 0.98,
          resetTime: '2099-10-01T00:00:00Z',
          description: '1 / 50',
        },
        { window: 'No fraction' },
      ],
    },
    { displayName: 'Empty', buckets: [] },
  ],
  summary: [
    { key: 'used_0', label: 'Credits used', value: 1, unit: 'credit', format: 'number' },
    { key: 'charges', label: 'Overage charges', value: 4.5, format: 'currency', currency: 'usd' },
    { key: 'bad', label: 'Not a number', value: '4' },
    { key: 'odd', label: 'Odd money', value: 2, format: 'currency', currency: 'credits' },
  ],
};

const classes = bindQuotaClasses(
  Object.fromEntries(QUOTA_CLASS_KEYS.map((key) => [key, key])),
  'test'
);
const t = ((key: string) => key) as unknown as TFunction;
const originalFetch = pluginQuotaApi.fetch;

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

afterEach(() => {
  pluginQuotaApi.fetch = originalFetch;
});

describe('parsePluginQuotaPayload', () => {
  test('keeps drawable buckets and valid figures only', () => {
    const data = parsePluginQuotaPayload(payload);
    expect(data?.subscription).toEqual({
      plan: 'KIRO FREE',
      tierName: null,
      tierId: 'Q_DEVELOPER_STANDALONE_FREE',
    });
    expect(data?.groups).toHaveLength(1);
    expect(data?.groups[0].buckets).toEqual([
      {
        id: 'plugin-0-0',
        label: 'Plan',
        remainingFraction: 0.98,
        resetTime: '2099-10-01T00:00:00Z',
        resetAtMs: Date.parse('2099-10-01T00:00:00Z'),
        description: '1 / 50',
      },
    ]);
    expect(data?.summary.map((metric) => [metric.key, metric.format, metric.currency])).toEqual([
      ['used_0', 'number', undefined],
      ['charges', 'currency', 'USD'],
      ['odd', 'number', undefined],
    ]);
  });

  test('reads snake_case spellings and rejects a body that is not an object', () => {
    const data = parsePluginQuotaPayload({
      subscription: { tier_name: 'Pro' },
      groups: [{ display_name: 'G', buckets: [{ remaining_fraction: '0.5', reset_time: 'x' }] }],
      server_time_offset_ms: 120,
    });
    expect(data?.subscription?.tierName).toBe('Pro');
    expect(data?.groups[0].label).toBe('G');
    expect(data?.groups[0].buckets[0].remainingFraction).toBe(0.5);
    expect(data?.groups[0].buckets[0].resetAtMs).toBeNull();
    expect(data?.serverTimeOffsetMs).toBe(120);
    expect(parsePluginQuotaPayload('nope')).toBeNull();
    expect(parsePluginQuotaPayload(null)).toBeNull();
  });
});

describe('plugin quota files', () => {
  test('are the supports_quota files of providers the panel has no adapter for', () => {
    expect(isPluginQuotaFile(kiro)).toBe(true);
    expect(isPluginQuotaFile({ ...kiro, supports_quota: 'true' })).toBe(true);
    expect(isPluginQuotaFile({ ...kiro, supports_quota: undefined })).toBe(false);
    expect(isPluginQuotaFile({ ...kiro, provider: 'codex' })).toBe(false);
    expect(PLUGIN_CONFIG.filterFn({ ...kiro, disabled: true })).toBe(false);
    expect(classifyQuotaFiles([kiro])).toEqual([{ file: kiro, type: 'plugin' }]);
  });

  test('show quota on the auth files page under all and under their own tab', () => {
    expect(resolveAuthFileQuotaType(kiro, 'all')).toBe('plugin');
    expect(resolveAuthFileQuotaType(kiro, 'kiro')).toBe('plugin');
    expect(resolveAuthFileQuotaType(kiro, 'codex')).toBeNull();
    expect(resolveAuthFileQuotaType(kiro, null)).toBeNull();
    expect(resolveAuthFileQuotaType({ ...kiro, supports_quota: false }, 'kiro')).toBeNull();
    expect(resolveAuthFileQuotaType({ name: 'c.json', provider: 'codex' }, 'codex')).toBe('codex');
  });

  test('fetch by auth index and fail without one', async () => {
    const asked: string[] = [];
    pluginQuotaApi.fetch = async (authIndex: string) => {
      asked.push(authIndex);
      return payload;
    };
    const data = await PLUGIN_CONFIG.fetchQuota(kiro, t);
    expect(asked).toEqual(['idx-a']);
    expect(data.groups[0].label).toBe('Credits');
    await expect(PLUGIN_CONFIG.fetchQuota({ ...kiro, authIndex: undefined }, t)).rejects.toThrow(
      'plugin_quota.missing_auth_index'
    );
    pluginQuotaApi.fetch = async () => 'not json';
    await expect(PLUGIN_CONFIG.fetchQuota(kiro, t)).rejects.toThrow('plugin_quota.empty_data');
  });
});

describe('PluginQuotaBody', () => {
  const success = (): PluginQuotaState =>
    PLUGIN_CONFIG.buildSuccessState(parsePluginQuotaPayload(payload)!);

  test('renders the plan, each meter with its figures, and the summary', () => {
    const markup = renderToStaticMarkup(
      createElement(PluginQuotaBody, { quota: success(), classes })
    );
    expect(markup).toContain('KIRO FREE');
    expect(markup).toContain('Credits');
    expect(markup).toContain('1 / 50');
    expect(markup).toContain('98% remaining');
    expect(markup).toContain('1 credit');
    expect(markup).toContain('$4.50');
  });

  test('says there is no data instead of rendering an empty card', () => {
    const markup = renderToStaticMarkup(
      createElement(PluginQuotaBody, {
        quota: { status: 'success', groups: [], summary: [], subscription: null },
        classes,
      })
    );
    expect(markup).toContain('No quota data available');
  });

  test('feeds its reset instants to the soonest-recovery ordering', () => {
    expect(collectQuotaRowInstants('plugin', success())).toEqual([
      { rowId: 'plugin-0-0', atMs: Date.parse('2099-10-01T00:00:00Z'), kind: 'window' },
    ]);
  });
});
