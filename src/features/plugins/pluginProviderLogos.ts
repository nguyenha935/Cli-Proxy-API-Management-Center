/**
 * Provider logos published by installed plugins.
 *
 * Built-in providers have their icon bundled in `AUTH_FILE_ICONS`, but a plugin
 * provider is unknown at build time, so its mark can only come from the plugin's
 * own metadata (`pluginapi.Metadata.Logo`). Without this, every plugin provider
 * renders as a bare initial on the auth-files and quota surfaces.
 */

import { create } from 'zustand';
import { pluginsApi } from '@/services/api';
import { useAuthStore } from '@/stores';
import type { PluginListEntry } from '@/types';
import { normalizeOAuthProviderKey } from '@/utils/providerKeys';
import { resolvePluginAssetURL } from './pluginResources';
import { useEffect } from 'react';

interface PluginProviderLogoState {
  /** Provider key (normalized) to a renderable image URL. */
  logos: Record<string, string>;
  /** apiBase the current map was resolved against; a change invalidates it. */
  apiBase: string | null;
  loading: boolean;
  load: (apiBase: string) => Promise<void>;
  clear: () => void;
}

// One in-flight request per apiBase. Three components mount at once on the
// auth-files page, and without this each would fire its own list call.
let pending: { apiBase: string; promise: Promise<void> } | null = null;

type PluginLogoSource = Pick<PluginListEntry, 'id' | 'logo' | 'metadata'> & {
  oauthProvider?: string;
};

/**
 * Maps installed plugins to provider logos. A plugin names the provider it
 * serves through `oauthProvider`; plugins that are a provider in their own right
 * fall back to their id. `logo` is the host-resolved value and
 * `metadata.logo` the raw plugin declaration, matching the OAuth page.
 */
export function buildPluginProviderLogoMap(
  plugins: readonly PluginLogoSource[],
  apiBase: string
): Record<string, string> {
  const logos: Record<string, string> = {};
  for (const plugin of plugins) {
    const provider = plugin.oauthProvider?.trim() || plugin.id.trim();
    if (!provider) continue;
    const logo = resolvePluginAssetURL(plugin.logo || plugin.metadata?.logo || '', apiBase);
    if (!logo) continue;
    logos[normalizeOAuthProviderKey(provider)] = logo;
  }
  return logos;
}

export const usePluginProviderLogoStore = create<PluginProviderLogoState>((set, get) => ({
  logos: {},
  apiBase: null,
  loading: false,

  load: async (apiBase: string) => {
    if (get().apiBase === apiBase) return;
    if (pending?.apiBase === apiBase) return pending.promise;

    const promise = (async () => {
      set({ loading: true });
      try {
        const response = await pluginsApi.list();
        set({
          logos: buildPluginProviderLogoMap(response.plugins, apiBase),
          apiBase,
          loading: false,
        });
      } catch {
        // A missing logo is cosmetic; the callers already fall back to an
        // initial. Record the attempt so it is not retried on every render.
        set({ logos: {}, apiBase, loading: false });
      } finally {
        pending = null;
      }
    })();

    pending = { apiBase, promise };
    return promise;
  },

  clear: () => {
    pending = null;
    set({ logos: {}, apiBase: null, loading: false });
  },
}));

/**
 * Returns every provider logo published by an installed plugin, keyed by
 * normalized provider key, loading the map on first use. Empty while loading and
 * for hosts with no plugin that publishes a logo.
 */
export function usePluginProviderLogos(): Record<string, string> {
  const apiBase = useAuthStore((state) => state.apiBase);
  const load = usePluginProviderLogoStore((state) => state.load);
  const logos = usePluginProviderLogoStore((state) => state.logos);

  useEffect(() => {
    if (!apiBase) return;
    void load(apiBase);
  }, [apiBase, load]);

  return logos;
}

/**
 * Single-provider form of {@link usePluginProviderLogos}. Returns null for
 * built-in providers and while loading.
 */
export function usePluginProviderLogo(providerKey: string): string | null {
  const logos = usePluginProviderLogos();
  return logos[normalizeOAuthProviderKey(providerKey)] ?? null;
}
