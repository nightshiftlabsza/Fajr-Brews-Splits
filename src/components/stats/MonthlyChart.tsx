import { useState } from 'react';

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

const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

interface MonthlyChartProps {
  monthlyOrders: number[];
  busiestMonth: number | null;
}

export function MonthlyChart({ monthlyOrders, busiestMonth }: MonthlyChartProps) {
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number | null>(null);

  const maxOrders = Math.max(...monthlyOrders, 1);
  const busiestMonthName = busiestMonth ? MONTH_NAMES[busiestMonth - 1] : null;

  return (
    <div className="stats-card">
      <div className="stats-monthly-header">
        <div>
          <div className="stats-card-eyebrow" style={{ marginBottom: 0 }}>
            Monthly rhythm
          </div>
        </div>
        {busiestMonthName && (
          <div className="stats-badge-pill">
            Busiest: {busiestMonthName}
          </div>
        )}
      </div>

      {/* Screen-reader accessible summary table */}
      <table className="sr-only">
        <caption>Monthly order counts</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Orders</th>
          </tr>
        </thead>
        <tbody>
          {monthlyOrders.map((count, index) => (
            <tr key={MONTH_NAMES[index]}>
              <th scope="row">{MONTH_NAMES[index]}</th>
              <td>{count}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Visual chart */}
      <div className="stats-month-chart" role="region" aria-label="Monthly order chart">
        {monthlyOrders.map((count, index) => {
          const isBusiest = busiestMonth === index + 1;
          const isSelected = selectedMonthIndex === index;
          const heightPercent = count > 0 ? Math.max((count / maxOrders) * 100, 15) : 0;
          const monthName = MONTH_NAMES[index] ?? '';
          const letter = MONTH_LETTERS[index] ?? '';

          return (
            <div
              key={monthName}
              role="button"
              tabIndex={0}
              className={`stats-month-col ${isBusiest ? 'is-busiest' : ''} ${isSelected ? 'is-active' : ''}`}
              onClick={() => setSelectedMonthIndex(index === selectedMonthIndex ? null : index)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedMonthIndex(index === selectedMonthIndex ? null : index);
                }
              }}
              aria-label={`${monthName}: ${count} ${count === 1 ? 'order' : 'orders'}`}
              aria-pressed={isSelected}
            >
              <div className="stats-month-bar-wrap">
                {count > 0 ? (
                  <div
                    className="stats-month-bar"
                    style={{ height: `${heightPercent}%` }}
                  />
                ) : (
                  <div className="stats-month-bar--zero" />
                )}
              </div>
              <span className="stats-month-label" aria-hidden="true">
                {letter}
              </span>
            </div>
          );
        })}
      </div>

      {/* Tap-to-read inspector text */}
      {selectedMonthIndex !== null && (
        <div className="stats-month-inspector" role="status">
          <strong>{MONTH_NAMES[selectedMonthIndex]}:</strong>{' '}
          {monthlyOrders[selectedMonthIndex]}{' '}
          {monthlyOrders[selectedMonthIndex] === 1 ? 'order' : 'orders'}
        </div>
      )}
    </div>
  );
}
