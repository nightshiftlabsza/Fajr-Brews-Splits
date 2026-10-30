import { useMemo, useState } from 'react';
import type { Order, Roaster } from '../../types';
import {
  compareSamePeriod,
  getCountedOrders,
  getCountedYears,
  getLocalTodayString,
  summarisePeriod,
} from '../../lib/yearInCoffee';
import { RoasterAvatar } from '../roaster/RoasterAvatar';
import { MonthlyChart } from './MonthlyChart';
import { YearPicker } from './YearPicker';

interface YearInCoffeeProps {
  orders: Order[];
  personId: string | null;
  personNames: Record<string, string>;
  roasters: Roaster[];
  initialYear?: string;
  onBack: () => void;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function YearInCoffee({
  orders,
  personId,
  personNames,
  roasters,
  initialYear,
  onBack,
}: YearInCoffeeProps) {
  const today = useMemo(() => getLocalTodayString(), []);
  const currentCalendarYear = today.split('-')[0]!;

  const { entries: allCountedOrders, skippedCount } = useMemo(
    () => getCountedOrders(orders, personId, personNames, roasters),
    [orders, personId, personNames, roasters],
  );

  const availableYears = useMemo(
    () => getCountedYears(orders, personId, personNames, roasters),
    [orders, personId, personNames, roasters],
  );

  const [selectedYear, setSelectedYear] = useState<string>(() => {
    if (initialYear && availableYears.includes(initialYear)) {
      return initialYear;
    }
    return availableYears[0] ?? currentCalendarYear;
  });

  const [activeChapter, setActiveChapter] = useState<string>('chapter-1');

  const summary = useMemo(() => {
    return summarisePeriod(allCountedOrders, {
      year: selectedYear,
      today,
      allTimeOrders: allCountedOrders,
      skippedCount,
    });
  }, [allCountedOrders, selectedYear, today, skippedCount]);

  const comparison = useMemo(() => {
    return compareSamePeriod(selectedYear, allCountedOrders, today);
  }, [selectedYear, allCountedOrders, today]);

  const orderCountByYear = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const entry of allCountedOrders) {
      const y = entry.order.orderDate.split('-')[0]!;
      counts[y] = (counts[y] ?? 0) + 1;
    }
    return counts;
  }, [allCountedOrders]);

  const scrollToChapter = (chapterId: string) => {
    setActiveChapter(chapterId);
    const el = document.getElementById(chapterId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Milestone checks
  const firstOrderMilestone = summary.firstOrder
    ? {
        date: summary.firstOrder.order.orderDate,
        title: summary.firstOrder.order.name,
        roaster: summary.firstOrder.roaster?.name ?? null,
      }
    : null;

  const newRoastersMilestone =
    summary.newRoasters.length > 0
      ? {
          count: summary.newRoasters.length,
          names: summary.newRoasters.map((r) => r.name).join(', '),
        }
      : null;

  const bestMonthMilestone = summary.busiestMonth
    ? {
        monthName: MONTH_NAMES[summary.busiestMonth - 1]!,
        ordersCount: summary.monthlyOrders[summary.busiestMonth - 1]!,
      }
    : null;

  const hasMilestones = Boolean(
    firstOrderMilestone || newRoastersMilestone || bestMonthMilestone,
  );

  const isOneOrderYear = summary.ordersCount === 1;

  if (availableYears.length === 0 || summary.ordersCount === 0) {
    return (
      <div className="stats-container">
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onBack}
            style={{ marginBottom: 'var(--space-4)' }}
          >
            ← Back to your coffee
          </button>
          <div className="stats-card" style={{ textAlign: 'center', padding: 'var(--space-10) var(--space-4)' }}>
            <h2 className="stats-title" style={{ marginBottom: 'var(--space-2)' }}>
              No orders for {selectedYear} yet
            </h2>
            <p className="stats-subtitle" style={{ marginBottom: 'var(--space-6)' }}>
              Once an order is done, your coffee journal for this year will appear here.
            </p>
            <button type="button" className="btn btn-primary" onClick={onBack}>
              Return to coffee overview
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stats-container yic-phone-container">
      {/* Top Bar */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onBack}
          style={{ marginBottom: 'var(--space-4)', minHeight: '44px' }}
        >
          ← Back to your coffee
        </button>
        <div className="stats-card-eyebrow">
          YEAR IN COFFEE · {selectedYear}
          {selectedYear === currentCalendarYear ? ' (so far)' : ''}
        </div>
        <h1 className="stats-title" style={{ fontSize: 'clamp(2rem, 4vw, 2.75rem)' }}>
          What you took from the orders this year.
        </h1>
        <p className="stats-subtitle">
          A quiet summary of shared bags, roasters, and grams ordered together.
        </p>
      </div>

      {/* Editorial Layout */}
      <div className="yic-editorial-shell">
        {/* Left Column (Desktop Sidebar) */}
        <aside className="yic-sidebar">
          <div className="yic-sidebar-sticky">
            <div className="stats-card" style={{ padding: 'var(--space-4)' }}>
              <div className="stats-card-eyebrow" style={{ marginBottom: 'var(--space-2)' }}>
                Reporting period
              </div>
              <YearPicker
                years={availableYears}
                selectedRange={{ preset: 'all' }}
                currentYear={currentCalendarYear}
                orderCountByYear={orderCountByYear}
                totalOrdersCount={allCountedOrders.length}
                onSelectYear={(yr) => {
                  if (yr) setSelectedYear(yr);
                }}
                onSelectRange={() => {}}
              />

              {comparison && comparison.hasPreviousYearOrders && (
                <div
                  style={{
                    marginTop: 'var(--space-3)',
                    paddingTop: 'var(--space-2)',
                    borderTop: '1px solid var(--color-border)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-text-secondary)',
                    lineHeight: 'var(--leading-normal)',
                  }}
                >
                  <strong>Same dates last year:</strong> {comparison.samePeriodPreviousOrders}{' '}
                  {comparison.samePeriodPreviousOrders === 1 ? 'order' : 'orders'} (
                  {comparison.samePeriodPreviousKg} kg)
                </div>
              )}
            </div>

            {/* Desktop Chapter Navigation */}
            <nav className="yic-chapter-nav" aria-label="Year in coffee chapters">
              <button
                type="button"
                className={`yic-chapter-btn ${activeChapter === 'chapter-1' ? 'is-active' : ''}`}
                onClick={() => scrollToChapter('chapter-1')}
              >
                <span>01 Your year</span>
                <span aria-hidden="true">→</span>
              </button>

              {summary.favouriteRoaster && !isOneOrderYear && (
                <button
                  type="button"
                  className={`yic-chapter-btn ${activeChapter === 'chapter-2' ? 'is-active' : ''}`}
                  onClick={() => scrollToChapter('chapter-2')}
                >
                  <span>02 Favourite roaster</span>
                  <span aria-hidden="true">→</span>
                </button>
              )}

              {summary.topCoffees.length > 0 && !isOneOrderYear && (
                <button
                  type="button"
                  className={`yic-chapter-btn ${activeChapter === 'chapter-3' ? 'is-active' : ''}`}
                  onClick={() => scrollToChapter('chapter-3')}
                >
                  <span>03 Coffees you tried</span>
                  <span aria-hidden="true">→</span>
                </button>
              )}

              {!isOneOrderYear && (
                <button
                  type="button"
                  className={`yic-chapter-btn ${activeChapter === 'chapter-4' ? 'is-active' : ''}`}
                  onClick={() => scrollToChapter('chapter-4')}
                >
                  <span>04 Your months</span>
                  <span aria-hidden="true">→</span>
                </button>
              )}

              {hasMilestones && (
                <button
                  type="button"
                  className={`yic-chapter-btn ${activeChapter === 'chapter-5' ? 'is-active' : ''}`}
                  onClick={() => scrollToChapter('chapter-5')}
                >
                  <span>05 Milestones</span>
                  <span aria-hidden="true">→</span>
                </button>
              )}
            </nav>
          </div>
        </aside>

        {/* Right Column (Chapters Scroll) */}
        <main className="yic-phone-scroll">
          {/* Chapter 1: Your Year */}
          <section id="chapter-1" className="yic-chapter-section" tabIndex={-1}>
            <div className="yic-chapter-num">01 · Your year</div>
            <div className="yic-hero-number">{summary.ordersCount}</div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {summary.ordersCount === 1 ? 'order you were part of' : 'orders you were part of'}
            </div>

            <div className="yic-summary-pill-row">
              <span>{summary.kgTaken} kg of coffee taken</span>
              <span aria-hidden="true">·</span>
              <span>
                {summary.bagsSharedIn} {summary.bagsSharedIn === 1 ? 'bag you shared in' : 'bags you shared in'}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {summary.roastersTried} {summary.roastersTried === 1 ? 'roaster tried' : 'roasters tried'}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {summary.coffeesTried} {summary.coffeesTried === 1 ? 'coffee tried' : 'coffees tried'}
              </span>
            </div>

            {summary.styleOfYear && (
              <div className="yic-style-badge">
                <span>{summary.styleOfYear.type}</span>
                <span className="yic-style-detail">({summary.styleOfYear.detail})</span>
              </div>
            )}
          </section>

          {/* Chapter 2: Favourite Roaster */}
          {summary.favouriteRoaster && !isOneOrderYear && (
            <section id="chapter-2" className="yic-chapter-section" tabIndex={-1}>
              <div className="yic-chapter-num">02 · Your favourite roaster</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', margin: 'var(--space-4) 0' }}>
                <RoasterAvatar
                  name={summary.favouriteRoaster.name}
                  logoUrl={summary.favouriteRoaster.logoUrl}
                  size={56}
                />
                <div>
                  <h3 style={{ margin: 0, fontSize: 'var(--text-xl)', color: 'var(--color-text-primary)' }}>
                    {summary.favouriteRoaster.name}
                  </h3>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    Most coffee taken
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-primary)', lineHeight: 'var(--leading-normal)' }}>
                You took the most coffee from them: <strong>{Math.round(summary.favouriteRoaster.share * 100)}%</strong> of your coffee this year.
              </div>

              {summary.runnerUpRoaster && (
                <div
                  style={{
                    marginTop: 'var(--space-4)',
                    paddingTop: 'var(--space-3)',
                    borderTop: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  <span style={{ color: 'var(--color-text-muted)' }}>Runner-up</span>
                  <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {summary.runnerUpRoaster.name} · {Math.round(summary.runnerUpRoaster.share * 100)}%
                  </span>
                </div>
              )}
            </section>
          )}

          {/* Chapter 3: Coffees you tried */}
          {summary.topCoffees.length > 0 && !isOneOrderYear && (
            <section id="chapter-3" className="yic-chapter-section" tabIndex={-1}>
              <div className="yic-chapter-num">03 · Coffees you tried</div>
              <h3 style={{ margin: '0 0 var(--space-1) 0', fontSize: 'var(--text-xl)', color: 'var(--color-text-primary)' }}>
                Ranked by coffee taken
              </h3>
              <p style={{ margin: '0 0 var(--space-4) 0', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                Typed coffee names from orders you were part of
              </p>

              <div className="stats-rank-list">
                {summary.topCoffees.map((coffee, idx) => (
                  <div
                    key={coffee.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 0',
                      borderBottom: idx < summary.topCoffees.length - 1 ? '1px solid var(--color-border)' : 'none',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {coffee.name}
                      </div>
                      {coffee.roasterName && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                          {coffee.roasterName} · {coffee.orderCount} {coffee.orderCount === 1 ? 'order' : 'orders'}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-accent)', fontVariantNumeric: 'tabular-nums' }}>
                      {coffee.grams.toLocaleString()}g
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Chapter 4: Your months */}
          {!isOneOrderYear && (
            <section id="chapter-4" className="yic-chapter-section" tabIndex={-1}>
              <div className="yic-chapter-num">04 · Your months</div>
              <MonthlyChart
                monthlyOrders={summary.monthlyOrders}
                busiestMonth={summary.busiestMonth}
              />
            </section>
          )}

          {/* Chapter 5: Milestones */}
          {hasMilestones && (
            <section id="chapter-5" className="yic-chapter-section" tabIndex={-1}>
              <div className="yic-chapter-num">05 · Milestones</div>
              <h3 style={{ margin: '0 0 var(--space-4) 0', fontSize: 'var(--text-xl)', color: 'var(--color-text-primary)' }}>
                Moments from your year
              </h3>

              <div className="stats-rank-list">
                {firstOrderMilestone && (
                  <div style={{ padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      First order of the year
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {firstOrderMilestone.date} · {firstOrderMilestone.title}
                      {firstOrderMilestone.roaster ? ` with ${firstOrderMilestone.roaster}` : ''}
                    </div>
                  </div>
                )}

                {newRoastersMilestone && (
                  <div style={{ padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {newRoastersMilestone.count} {newRoastersMilestone.count === 1 ? 'roaster tried for the first time' : 'roasters tried for the first time'}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {newRoastersMilestone.names}
                    </div>
                  </div>
                )}

                {bestMonthMilestone && (
                  <div style={{ padding: '10px 0' }}>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      Busiest month: {bestMonthMilestone.monthName}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {bestMonthMilestone.ordersCount} {bestMonthMilestone.ordersCount === 1 ? 'order done' : 'orders done'}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Chapter 6: Closing */}
          <section className="yic-chapter-section" style={{ textAlign: 'center', padding: 'var(--space-8) var(--space-4)' }}>
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
              That was your {selectedYear} in coffee.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onBack}
              style={{ minHeight: '44px' }}
            >
              Back to your coffee
            </button>
          </section>
        </main>
      </div>

      {/* Phone Progress Dots */}
      <div className="yic-dots-indicator" aria-label="Chapter progress">
        <button
          type="button"
          className={`yic-dot-btn ${activeChapter === 'chapter-1' ? 'is-active' : ''}`}
          onClick={() => scrollToChapter('chapter-1')}
          aria-label="Chapter 1: Your year"
        >
          <div className="yic-dot-circle" />
        </button>
        {summary.favouriteRoaster && !isOneOrderYear && (
          <button
            type="button"
            className={`yic-dot-btn ${activeChapter === 'chapter-2' ? 'is-active' : ''}`}
            onClick={() => scrollToChapter('chapter-2')}
            aria-label="Chapter 2: Favourite roaster"
          >
            <div className="yic-dot-circle" />
          </button>
        )}
        {summary.topCoffees.length > 0 && !isOneOrderYear && (
          <button
            type="button"
            className={`yic-dot-btn ${activeChapter === 'chapter-3' ? 'is-active' : ''}`}
            onClick={() => scrollToChapter('chapter-3')}
            aria-label="Chapter 3: Coffees you tried"
          >
            <div className="yic-dot-circle" />
          </button>
        )}
        {!isOneOrderYear && (
          <button
            type="button"
            className={`yic-dot-btn ${activeChapter === 'chapter-4' ? 'is-active' : ''}`}
            onClick={() => scrollToChapter('chapter-4')}
            aria-label="Chapter 4: Your months"
          >
            <div className="yic-dot-circle" />
          </button>
        )}
        {hasMilestones && (
          <button
            type="button"
            className={`yic-dot-btn ${activeChapter === 'chapter-5' ? 'is-active' : ''}`}
            onClick={() => scrollToChapter('chapter-5')}
            aria-label="Chapter 5: Milestones"
          >
            <div className="yic-dot-circle" />
          </button>
        )}
      </div>
    </div>
  );
}
