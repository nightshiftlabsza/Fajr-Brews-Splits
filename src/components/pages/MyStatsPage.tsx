import { useMemo, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import {
  calculateMyStatsSummary,
  filterParticipantOrdersByRange,
  getParticipantFinalizedOrders,
  resolveLinkedStatsPerson,
  type StatsDateRange,
  type StatsRangePreset,
} from '../../lib/myStats';
import { formatCurrency, formatDateShort, formatNumber } from '../../lib/formatters';
import { RoasterAvatar } from '../roaster/RoasterAvatar';

const RANGE_OPTIONS: { id: StatsRangePreset; label: string }[] = [
  { id: 'all', label: 'All time' },
  { id: '3m', label: 'Last 3 months' },
  { id: '6m', label: 'Last 6 months' },
  { id: '12m', label: 'Last 12 months' },
  { id: 'custom', label: 'Custom range' },
];

export function MyStatsPage() {
  const { orders, roasters, people, linkedPersonId, linkResolution } = useAppStore();
  const [range, setRange] = useState<StatsDateRange>({ preset: 'all' });

  const personNames = useMemo(
    () => Object.fromEntries(people.map((person) => [person.id, person.name])),
    [people],
  );

  const linkedStatsPerson = resolveLinkedStatsPerson(linkedPersonId, linkResolution);
  const finalizedOrders = useMemo(
    () => getParticipantFinalizedOrders(orders, linkedStatsPerson.personId, personNames, roasters),
    [linkedStatsPerson.personId, orders, personNames, roasters],
  );
  const filteredOrders = useMemo(
    () => filterParticipantOrdersByRange(finalizedOrders, range),
    [finalizedOrders, range],
  );
  const summary = useMemo(
    () => calculateMyStatsSummary(filteredOrders),
    [filteredOrders],
  );

  if (linkedStatsPerson.state === 'unlinked') {
    return (
      <div className="page-container">
        <StatsHeader />
        <div className="empty-state">
          <div className="empty-state-icon">☕</div>
          <h3>Link a participant to unlock My Stats</h3>
          <p>
            My Stats becomes available once this account is linked to a participant record in the workspace.
          </p>
        </div>
      </div>
    );
  }

  if (linkedStatsPerson.state === 'ambiguous') {
    return (
      <div className="page-container">
        <StatsHeader />
        <div className="empty-state">
          <div className="empty-state-icon">?</div>
          <h3>We still need to confirm your participant link</h3>
          <p>
            My Stats will appear once the participant link is confirmed. The app will not guess when the match is ambiguous.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container stats-page">
      <StatsHeader />

      <section className="wizard-panel">
        <div className="wizard-card-header stats-filter-header">
          <div>
            <div className="section-label" style={{ marginBottom: 'var(--space-2)' }}>Time range</div>
            <div className="wizard-card-title">Only your finalized coffee history</div>
            <p className="wizard-card-copy" style={{ marginTop: 'var(--space-2)' }}>
              Stats are calculated only from finalized orders where your linked participant record was part of the allocation.
            </p>
          </div>
          <div className="stats-filter-pills" role="tablist" aria-label="Stats time range">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`stats-filter-pill ${range.preset === option.id ? 'is-active' : ''}`}
                onClick={() => setRange((current) => ({
                  ...current,
                  preset: option.id,
                }))}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {range.preset === 'custom' && (
          <div className="wizard-card-grid stats-custom-range">
            <div className="field">
              <label className="field-label" htmlFor="stats-start-date">Start date</label>
              <input
                id="stats-start-date"
                className="input"
                type="date"
                value={range.startDate ?? ''}
                onChange={(event) => setRange((current) => ({ ...current, startDate: event.target.value }))}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="stats-end-date">End date</label>
              <input
                id="stats-end-date"
                className="input"
                type="date"
                value={range.endDate ?? ''}
                onChange={(event) => setRange((current) => ({ ...current, endDate: event.target.value }))}
              />
            </div>
          </div>
        )}
      </section>

      {filteredOrders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <h3>No finalized orders in this range yet</h3>
          <p>
            As soon as finalized orders include your linked participant record, your personal coffee stats will show up here.
          </p>
        </div>
      ) : (
        <>
          <section className="stats-grid">
            <MetricCard label="Total bags bought" value={`${formatNumber(summary.totalBags, 1)} bags`} />
            <MetricCard label="Total grams bought" value={`${formatNumber(summary.totalGrams, 0)}g`} />
            <MetricCard label="Total spent" value={formatCurrency(summary.totalSpent)} emphasize />
            <MetricCard
              label="Average cost per 250g"
              value={summary.averageCostPer250g === null ? 'Not available' : formatCurrency(summary.averageCostPer250g)}
            />
            <MetricCard
              label="Finalized orders"
              value={String(filteredOrders.length)}
              detail={`Newest: ${formatDateShort(filteredOrders[0]?.order.orderDate ?? '')}`}
            />
          </section>

          <section className="wizard-panel stats-favorite-panel">
            <div className="wizard-card-header">
              <div>
                <div className="section-label" style={{ marginBottom: 'var(--space-2)' }}>Favorite roaster</div>
                <div className="wizard-card-title">Most ordered by 250g-equivalent bags</div>
              </div>
            </div>

            {summary.favoriteRoaster ? (
              <div className="stats-favorite-card">
                <RoasterAvatar
                  name={summary.favoriteRoaster.name}
                  logoUrl={summary.favoriteRoaster.logoUrl}
                  size={60}
                />
                <div>
                  <div className="stats-favorite-name">{summary.favoriteRoaster.name}</div>
                  <div className="wizard-card-copy">
                    {formatNumber(summary.favoriteRoaster.bagCount, 1)} bags across the selected range.
                  </div>
                </div>
              </div>
            ) : (
              <div className="wizard-inline-empty">
                <span>No favorite roaster yet.</span>
                <span className="field-hint">
                  Some finalized orders in this range do not have roaster data yet, so the app skips them instead of guessing.
                </span>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function StatsHeader() {
  return (
    <div style={{ marginBottom: 'var(--space-6)' }}>
      <h2 style={{ marginBottom: 4 }}>My Stats</h2>
      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
        Your own coffee-order metrics only. No shared invoices, payment widgets, or other people&apos;s details.
      </p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  emphasize = false,
}: {
  label: string;
  value: string;
  detail?: string;
  emphasize?: boolean;
}) {
  return (
    <article className={`wizard-metric stats-metric-card ${emphasize ? 'is-emphasized' : ''}`}>
      <div className="wizard-metric-label">{label}</div>
      <div className="wizard-metric-value">{value}</div>
      {detail && <div className="field-hint">{detail}</div>}
    </article>
  );
}
