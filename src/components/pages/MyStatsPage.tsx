import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../store/appStore';
import {
  getCountedOrders,
  getCountedYears,
  getLocalTodayString,
  resolveLinkedStatsPerson,
  summarisePeriod,
  type StatsDateRange,
} from '../../lib/myStats';
import { formatDateShort, formatZAR } from '../../lib/formatters';
import { RoasterAvatar } from '../roaster/RoasterAvatar';
import { YearPicker } from '../stats/YearPicker';
import { MonthlyChart } from '../stats/MonthlyChart';
import { CameBackToList } from '../stats/CameBackToList';
import { YearInCoffee } from '../stats/YearInCoffee';

export function MyStatsPage() {
  const { orders, roasters, people, linkedPersonId, linkResolution, isLoading } = useAppStore(
    useShallow((s) => ({
      orders: s.orders,
      roasters: s.roasters,
      people: s.people,
      linkedPersonId: s.linkedPersonId,
      linkResolution: s.linkResolution,
      isLoading: s.isLoading,
    })),
  );

  const [range, setRange] = useState<StatsDateRange>({ preset: 'all' });
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'overview' | 'year-in-coffee'>('overview');

  const today = useMemo(() => getLocalTodayString(), []);
  const currentCalendarYear = today.split('-')[0]!;

  const personNames = useMemo(
    () => Object.fromEntries(people.map((person) => [person.id, person.name])),
    [people],
  );

  const linkedStatsPerson = resolveLinkedStatsPerson(linkedPersonId, linkResolution);

  const { entries: allCountedOrders, skippedCount } = useMemo(
    () => getCountedOrders(orders, linkedStatsPerson.personId, personNames, roasters),
    [orders, linkedStatsPerson.personId, personNames, roasters],
  );

  const availableYears = useMemo(
    () => getCountedYears(orders, linkedStatsPerson.personId, personNames, roasters),
    [orders, linkedStatsPerson.personId, personNames, roasters],
  );

  const orderCountByYear = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const entry of allCountedOrders) {
      const y = entry.order.orderDate.split('-')[0]!;
      counts[y] = (counts[y] ?? 0) + 1;
    }
    return counts;
  }, [allCountedOrders]);

  const summary = useMemo(() => {
    return summarisePeriod(allCountedOrders, {
      year: selectedYear ?? undefined,
      range: selectedYear ? undefined : range,
      today,
      allTimeOrders: allCountedOrders,
      skippedCount,
    });
  }, [allCountedOrders, selectedYear, range, today, skippedCount]);

  if (isLoading) {
    return (
      <div className="stats-container">
        <div className="stats-header-section">
          <div style={{ height: 32, width: 200, background: 'var(--color-surface-raised)', borderRadius: 'var(--radius-sm)', marginBottom: 8 }} />
          <div style={{ height: 18, width: 340, background: 'var(--color-surface-raised)', borderRadius: 'var(--radius-sm)' }} />
        </div>
        <div className="stats-card" style={{ height: 120, background: 'var(--color-surface-raised)' }} />
      </div>
    );
  }

  if (linkedStatsPerson.state === 'unlinked') {
    return (
      <div className="stats-container">
        <div className="stats-header-section">
          <h1 className="stats-title">Your coffee</h1>
          <p className="stats-subtitle">
            Link a participant profile to see your personal coffee journal.
          </p>
        </div>
        <div className="stats-card" style={{ textAlign: 'center', padding: 'var(--space-10) var(--space-4)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-2)' }}>☕</div>
          <h3 style={{ margin: '0 0 var(--space-2) 0', color: 'var(--color-text-primary)' }}>
            Link a profile to view your stats
          </h3>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}>
            Personal statistics become available once your signed-in account is linked to your participant profile in the workspace.
          </p>
        </div>
      </div>
    );
  }

  if (linkedStatsPerson.state === 'ambiguous') {
    return (
      <div className="stats-container">
        <div className="stats-header-section">
          <h1 className="stats-title">Your coffee</h1>
          <p className="stats-subtitle">Confirm your participant link to continue.</p>
        </div>
        <div className="stats-card" style={{ textAlign: 'center', padding: 'var(--space-10) var(--space-4)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-2)' }}>?</div>
          <h3 style={{ margin: '0 0 var(--space-2) 0', color: 'var(--color-text-primary)' }}>
            We still need to confirm your profile
          </h3>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}>
            Your coffee statistics will appear as soon as the link to your directory record is confirmed.
          </p>
        </div>
      </div>
    );
  }

  if (allCountedOrders.length === 0) {
    return (
      <div className="stats-container">
        <div className="stats-header-section">
          <h1 className="stats-title">Your coffee</h1>
          <p className="stats-subtitle">From orders you were part of, once they are done.</p>
        </div>
        <div className="stats-card" style={{ textAlign: 'center', padding: 'var(--space-10) var(--space-4)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-2)' }}>📦</div>
          <h3 style={{ margin: '0 0 var(--space-2) 0', color: 'var(--color-text-primary)' }}>
            No orders you were part of yet
          </h3>
          <p style={{ margin: '0 0 var(--space-4) 0', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            Once an order is done, your coffees, roasters, and grams will appear here.
          </p>
          <a href="/" className="btn btn-primary" style={{ display: 'inline-flex', minHeight: '44px', alignItems: 'center' }}>
            Start an order →
          </a>
        </div>
      </div>
    );
  }

  if (currentView === 'year-in-coffee') {
    return (
      <YearInCoffee
        orders={orders}
        personId={linkedStatsPerson.personId}
        personNames={personNames}
        roasters={roasters}
        initialYear={selectedYear ?? availableYears[0]}
        onBack={() => setCurrentView('overview')}
      />
    );
  }

  const isOneOrderPeriod = summary.ordersCount === 1;

  return (
    <div className="stats-container">
      {/* Header & Context */}
      <div className="stats-header-section">
        <h1 className="stats-title">Your coffee</h1>
        <p className="stats-subtitle">From orders you were part of, once they are done.</p>

        <div className="stats-period-bar">
          <YearPicker
            years={availableYears}
            selectedRange={selectedYear ? { preset: 'all' } : range}
            currentYear={currentCalendarYear}
            orderCountByYear={orderCountByYear}
            totalOrdersCount={allCountedOrders.length}
            onSelectYear={(yr) => {
              setSelectedYear(yr);
              if (yr) setRange({ preset: 'all' });
            }}
            onSelectRange={(r) => {
              setSelectedYear(null);
              setRange(r);
            }}
          />
          <div className="stats-period-context">
            {summary.ordersCount} {summary.ordersCount === 1 ? 'order you were part of' : 'orders you were part of'}
            {skippedCount > 0 && (
              <span style={{ marginLeft: 'var(--space-2)', color: 'var(--color-warning)' }}>
                · {skippedCount} {skippedCount === 1 ? 'order could not be counted' : 'orders could not be counted'}
              </span>
            )}
          </div>
        </div>
      </div>

      {summary.ordersCount === 0 ? (
        <div className="stats-card" style={{ textAlign: 'center', padding: 'var(--space-8) var(--space-4)' }}>
          <h3 style={{ margin: '0 0 var(--space-2) 0', color: 'var(--color-text-primary)' }}>
            No orders in this range yet
          </h3>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            Try choosing another year or All time to see your full coffee history.
          </p>
        </div>
      ) : (
        <>
          {/* Quiet Banner to Year in Coffee */}
          <button
            type="button"
            className="stats-recap-banner"
            onClick={() => setCurrentView('year-in-coffee')}
            aria-label="View Year in Coffee recap"
          >
            <div>
              <div className="stats-recap-title-wrap">
                <span className="stats-recap-title">
                  Your Year in Coffee, {selectedYear ?? currentCalendarYear}
                  {selectedYear === currentCalendarYear || (!selectedYear && availableYears.includes(currentCalendarYear)) ? ' so far' : ''}
                </span>
                <span className="stats-recap-badge">Recap</span>
              </div>
              <div className="stats-recap-sub">A look back at your year</div>
            </div>
            <span className="stats-recap-arrow" aria-hidden="true">→</span>
          </button>

          {/* Desktop Two-Column Arrangement for Cards */}
          <div className="stats-desktop-grid">
            {/* Left Column: Headline facts & Favourite roaster */}
            <div>
              {/* Three Headline Facts */}
              <div className="stats-card stats-headline-grid" role="region" aria-label="Key coffee facts">
                <div className="stats-headline-item">
                  <div className="stats-headline-value">
                    {summary.kgTaken}
                    <span className="stats-headline-unit">kg</span>
                  </div>
                  <div className="stats-headline-label">Coffee taken</div>
                </div>

                <div className="stats-headline-item">
                  <div className="stats-headline-value">{summary.bagsSharedIn}</div>
                  <div className="stats-headline-label">Bags you shared in</div>
                </div>

                <div className="stats-headline-item">
                  <div className="stats-headline-value">{summary.roastersTried}</div>
                  <div className="stats-headline-label">Roasters tried</div>
                </div>
              </div>

              {/* Favourite Roaster Card */}
              {summary.favouriteRoaster ? (
                <div className="stats-card">
                  <div className="stats-card-eyebrow">Favourite roaster</div>
                  <div className="stats-fav-row">
                    <RoasterAvatar
                      name={summary.favouriteRoaster.name}
                      logoUrl={summary.favouriteRoaster.logoUrl}
                      size={52}
                    />
                    <div className="stats-fav-info">
                      <div className="stats-fav-name">{summary.favouriteRoaster.name}</div>
                      <div className="stats-fav-detail">
                        {Math.round(summary.favouriteRoaster.share * 100)}% of the coffee you took · {summary.favouriteRoaster.orderCount}{' '}
                        {summary.favouriteRoaster.orderCount === 1 ? 'order' : 'orders'}
                      </div>
                    </div>
                  </div>

                  {summary.unassignedRoasterOrderCount > 0 && (
                    <div className="stats-unassigned-note">
                      {summary.unassignedRoasterOrderCount}{' '}
                      {summary.unassignedRoasterOrderCount === 1
                        ? 'order has no roaster saved'
                        : 'orders have no roaster saved'}
                    </div>
                  )}
                </div>
              ) : summary.unassignedRoasterOrderCount > 0 ? (
                <div className="stats-card">
                  <div className="stats-card-eyebrow">Favourite roaster</div>
                  <div className="stats-unassigned-note" style={{ marginTop: 0, borderTop: 'none', paddingTop: 0 }}>
                    {summary.unassignedRoasterOrderCount}{' '}
                    {summary.unassignedRoasterOrderCount === 1
                      ? 'order has no roaster saved'
                      : 'orders have no roaster saved'}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Right Column: Came back to & Monthly rhythm */}
            <div>
              {/* You keep coming back to */}
              <CameBackToList roasters={summary.cameBackTo} />

              {/* Monthly rhythm */}
              {!isOneOrderPeriod && (
                <MonthlyChart
                  monthlyOrders={summary.monthlyOrders}
                  busiestMonth={summary.busiestMonth}
                />
              )}
            </div>
          </div>

          {/* Recent Orders List */}
          <div className="stats-card stats-orders-card" style={{ marginTop: 'var(--space-2)' }}>
            <div className="stats-orders-header">
              <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontSize: 'var(--text-base)' }}>
                Recent orders you were part of
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                Latest {Math.min(summary.entries.length, 10)}
              </div>
            </div>

            <div>
              {summary.entries.slice(0, 10).map(({ order, personCalc, roaster, lotNames }) => {
                const coffeeTitle = lotNames.length > 0 ? lotNames.join(', ') : order.name;
                const formattedDate = formatDateShort(order.orderDate);
                const roasterLabel = roaster?.name ? `${roaster.name} · ` : '';

                return (
                  <div key={order.id} className="stats-order-row">
                    <div className="stats-order-primary">
                      <div className="stats-order-coffee-name">{coffeeTitle}</div>
                      <div className="stats-order-meta">
                        {roasterLabel}{formattedDate} · {order.name}
                      </div>
                    </div>
                    <div className="stats-order-secondary">
                      <div className="stats-order-grams">{personCalc.totalGrams}g</div>
                      <div className="stats-order-money">
                        Your share: {formatZAR(personCalc.totalFinal)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
