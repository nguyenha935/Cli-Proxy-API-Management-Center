import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

describe('plugin page frame contract', () => {
  const source = readFileSync(
    new URL('../src/features/plugins/PluginResourcePage.tsx', import.meta.url),
    'utf8'
  );

  // Plugin pages read the management key from the panel's own storage, so the
  // frame must stay on the panel origin. A `sandbox` without `allow-same-origin`
  // puts the frame in an opaque origin, where localStorage and window.parent are
  // both unreachable, and a plugin that reads the key there is left asking for
  // it by hand on every load. Measured on this deployment: 2 of the 4 installed
  // plugins (manager-key-pro, model-router) read `cli-proxy-auth` /
  // `managementKey` from that storage.
  it('keeps plugin frames on the panel origin', () => {
    expect(source).not.toContain('sandbox=');
  });

  // The panel does not hand the frame anything on the URL. It used to, through
  // a `buildPluginResourceFrameURL` helper carrying theme and language, but that
  // was unfinished work that reached main by accident, and measuring it found
  // one reader for half of it: manager-key-pro reads `theme`, nobody reads
  // `lang`, and manager-key-pro already followed the panel theme through
  // `window.parent` because the frame is same-origin. Reverted to upstream.
  it('resolves the frame URL the way upstream does', () => {
    expect(source).toContain('resolvePluginAssetURL(resource.menu.path, apiBase)');
    expect(source).not.toContain('buildPluginResourceFrameURL');
  });
});
