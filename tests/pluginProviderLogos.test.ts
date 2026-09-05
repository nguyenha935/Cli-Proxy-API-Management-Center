import { beforeEach, describe, expect, test } from 'bun:test';
import {
  buildPluginProviderLogoMap,
  usePluginProviderLogoStore,
} from '../src/features/plugins/pluginProviderLogos';
import { getAuthFileIcon } from '../src/features/authFiles/constants';

const entry = (over: Partial<Parameters<typeof buildPluginProviderLogoMap>[0][number]> = {}) => ({
  id: 'kiro',
  logo: '',
  metadata: null,
  ...over,
});

describe('plugin provider logos', () => {
  beforeEach(() => {
    usePluginProviderLogoStore.getState().clear();
  });

  test('a plugin provider without a bundled icon is the gap this closes', () => {
    // Guards the premise: if a future release bundles a kiro icon, the fallback
    // is no longer the only source and this suite should be revisited.
    expect(getAuthFileIcon('kiro', 'light')).toBeNull();
  });

  test('publishes the logo under the provider the plugin serves', () => {
    const logos = buildPluginProviderLogoMap(
      [entry({ id: 'kiro-cpa-plugin', oauthProvider: 'kiro', logo: 'data:image/png;base64,AAA' })],
      'https://api.example.test'
    );
    expect(logos).toEqual({ kiro: 'data:image/png;base64,AAA' });
  });

  test('falls back to the plugin id when it declares no oauth provider', () => {
    const logos = buildPluginProviderLogoMap(
      [entry({ id: 'Kiro', logo: 'data:image/png;base64,AAA' })],
      'https://api.example.test'
    );
    expect(logos.kiro).toBe('data:image/png;base64,AAA');
  });

  test('reads metadata.logo when the host did not resolve one', () => {
    const logos = buildPluginProviderLogoMap(
      [
        entry({
          oauthProvider: 'kiro',
          metadata: {
            name: 'Kiro',
            version: 'dev',
            author: '',
            githubRepository: '',
            logo: 'data:image/png;base64,BBB',
            configFields: [],
          },
        }),
      ],
      'https://api.example.test'
    );
    expect(logos.kiro).toBe('data:image/png;base64,BBB');
  });

  test('prefixes a host-relative asset path with the api base', () => {
    const logos = buildPluginProviderLogoMap(
      [entry({ oauthProvider: 'kiro', logo: '/v0/plugins/kiro/logo.png' })],
      'https://api.example.test'
    );
    expect(logos.kiro).toBe('https://api.example.test/v0/plugins/kiro/logo.png');
  });

  test('leaves out plugins that publish no logo', () => {
    expect(buildPluginProviderLogoMap([entry({ oauthProvider: 'kiro' })], '')).toEqual({});
  });

  test('normalizes the provider key the same way the auth-files pages do', () => {
    const logos = buildPluginProviderLogoMap(
      [entry({ oauthProvider: ' Some_Provider ', logo: 'data:image/png;base64,AAA' })],
      ''
    );
    expect(logos['some-provider']).toBe('data:image/png;base64,AAA');
  });

  test('clear() drops a cached map so a new connection reloads it', () => {
    usePluginProviderLogoStore.setState({
      logos: { kiro: 'data:image/png;base64,AAA' },
      apiBase: 'https://api.example.test',
    });
    usePluginProviderLogoStore.getState().clear();
    expect(usePluginProviderLogoStore.getState().logos).toEqual({});
    expect(usePluginProviderLogoStore.getState().apiBase).toBeNull();
  });
});
