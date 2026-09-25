/**
 * Plugin quota body: plan chip, one meter per bucket grouped as the plugin
 * reported them, then the plugin's summary figures.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { PluginQuotaMetric, PluginQuotaState } from '@/types';
import { buildResetDisplay } from '@/utils/quota';
import { useNow } from '@/hooks/useNow';
import { QuotaMeter } from '../../components/QuotaMeter';
import { QuotaResetLabel } from '../../components/QuotaResetLabel';
import { collectQuotaRowInstants, pickUrgentRowId } from '../../resetSchedule';
import type { QuotaBodyProps } from '../../types';

const formatPluginQuotaMetric = (metric: PluginQuotaMetric, locale?: string): string => {
  if (metric.format === 'currency' && metric.currency) {
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency: metric.currency }).format(
        metric.value
      );
    } catch {
      // A code Intl does not know falls through to a plain figure.
    }
  }
  const figure = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(metric.value);
  return metric.unit ? `${figure} ${metric.unit}` : figure;
};

export function PluginQuotaBody({ quota, classes }: QuotaBodyProps<PluginQuotaState>) {
  const { t, i18n } = useTranslation();
  // Ahead of the early return below — hooks cannot be conditional.
  const now = useNow() + (quota.serverTimeOffsetMs ?? 0);
  const soonestRowId = useMemo(
    () => pickUrgentRowId(collectQuotaRowInstants('plugin', quota), now),
    [quota, now]
  );
  const groups = quota.groups ?? [];
  const summary = quota.summary ?? [];
  const subscription = quota.subscription;
  const planLabel = subscription
    ? subscription.plan || subscription.tierName || subscription.tierId
    : null;

  if (!planLabel && groups.length === 0 && summary.length === 0) {
    return <div className={classes.quotaMessage}>{t('plugin_quota.empty_data')}</div>;
  }

  return (
    <>
      {planLabel && (
        <div className={classes.codexPlan}>
          <span className={classes.codexPlanItem}>
            <span className={classes.codexPlanLabel}>{t('plugin_quota.plan_label')}</span>
            <span className={classes.codexPlanValue}>{planLabel}</span>
          </span>
        </div>
      )}
      {groups.map((group) => (
        <div key={group.id} className={classes.antigravityQuotaGroup}>
          {group.label && (
            <div className={classes.antigravityQuotaGroupHeader}>
              <span className={classes.antigravityQuotaGroupTitle}>{group.label}</span>
            </div>
          )}
          {group.buckets.map((bucket, index) => {
            const percent = Math.max(0, Math.min(1, bucket.remainingFraction)) * 100;
            const resetDisplay = buildResetDisplay(
              null,
              bucket.resetAtMs,
              now,
              i18n.resolvedLanguage
            );
            const soon = bucket.id === soonestRowId;
            return (
              <div
                key={bucket.id}
                className={classes.quotaRow}
                title={soon ? t('quota_management.soonest_row_hint') : undefined}
              >
                <div className={classes.quotaRowHeader}>
                  <span className={classes.quotaModel}>{bucket.label}</span>
                  <div className={classes.quotaMeta}>
                    {bucket.description && bucket.description !== bucket.label && (
                      <span className={classes.quotaAmount}>{bucket.description}</span>
                    )}
                    <span className={classes.quotaPercent}>
                      {t('plugin_quota.remaining_percent', { percent: Math.round(percent) })}
                    </span>
                    {resetDisplay && (
                      <QuotaResetLabel display={resetDisplay} classes={classes} soon={soon} />
                    )}
                  </div>
                </div>
                <QuotaMeter percent={percent} classes={classes} index={index} />
              </div>
            );
          })}
        </div>
      ))}
      {summary.map((metric) => (
        <div key={metric.key} className={classes.quotaRow}>
          <div className={classes.quotaRowHeader}>
            <span className={classes.quotaModel}>{metric.label}</span>
            <span className={classes.quotaAmount}>
              {formatPluginQuotaMetric(metric, i18n.resolvedLanguage)}
            </span>
          </div>
        </div>
      ))}
    </>
  );
}
