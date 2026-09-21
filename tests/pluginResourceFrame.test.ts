import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { buildPluginResourceFrameURL } from '@/features/plugins/pluginResources';

describe('buildPluginResourceFrameURL', () => {
  it('resolves a registered resource path against the API base', () => {
    expect(
      buildPluginResourceFrameURL('/v0/resource/plugins/kiro/usage/abc', 'https://api.example.com')
    ).toBe('https://api.example.com/v0/resource/plugins/kiro/usage/abc');
  });

  it('carries the panel theme and language to the plugin page', () => {
    expect(
      buildPluginResourceFrameURL('/v0/resource/plugins/kiro/usage/abc', 'https://api.example.com', {
        theme: 'light',
        lang: 'vi',
      })
    ).toBe('https://api.example.com/v0/resource/plugins/kiro/usage/abc?theme=light&lang=vi');
  });

  it('appends to a path that already carries a query', () => {
    expect(
      buildPluginResourceFrameURL('/v0/resource/plugins/x/page?tab=usage', 'https://api.example.com', {
        theme: 'dark',
      })
    ).toBe('https://api.example.com/v0/resource/plugins/x/page?tab=usage&theme=dark');
  });

  it('keeps the fragment after the appended query', () => {
    expect(
      buildPluginResourceFrameURL('/v0/resource/plugins/x/page#top', 'https://api.example.com', {
        lang: 'en',
      })
    ).toBe('https://api.example.com/v0/resource/plugins/x/page?lang=en#top');
  });

  it('leaves the URL untouched when the panel has nothing to declare', () => {
    expect(
      buildPluginResourceFrameURL('/v0/resource/plugins/x/page', 'https://api.example.com', {
        theme: '  ',
        lang: '',
      })
    ).toBe('https://api.example.com/v0/resource/plugins/x/page');
  });

  it('encodes values instead of splicing them into the query', () => {
    expect(
      buildPluginResourceFrameURL('/v0/resource/plugins/x/page', 'https://api.example.com', {
        theme: 'dark&admin=1',
      })
    ).toBe('https://api.example.com/v0/resource/plugins/x/page?theme=dark%26admin%3D1');
  });

  it('returns nothing for an empty path so the caller can render its own state', () => {
    expect(buildPluginResourceFrameURL('', 'https://api.example.com', { theme: 'dark' })).toBe('');
  });
});

describe('plugin page frame contract', () => {
  const source = readFileSync(
    new URL('../src/features/plugins/PluginResourcePage.tsx', import.meta.url),
    'utf8'
  );

  it('frames third-party plugin documents sandboxed', () => {
    expect(source).toContain('sandbox="allow-scripts"');
  });

  it('builds the frame URL through the helper, with the panel theme and language', () => {
    expect(source).toContain('buildPluginResourceFrameURL(resource.menu.path, apiBase, {');
    expect(source).toContain('theme: resolvedTheme,');
    expect(source).toContain('lang: i18n.resolvedLanguage,');
  });
});
