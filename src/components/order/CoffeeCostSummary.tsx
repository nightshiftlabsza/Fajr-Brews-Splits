import type { CalculationResult } from '../../types';
import { formatGrams, formatZAR } from '../../lib/formatters';

interface Props {
  result: CalculationResult;
  title?: string;
  description?: string;
}

export function CoffeeCostSummary({
  result,
  title = 'Coffee cost summary',
  description,
}: Props) {
  const lotsTotalZar = result.lotCalcs.reduce((sum, lot) => sum + lot.totalZar, 0);
  const totalBags = result.lotCalcs.reduce((sum, lot) => sum + lot.quantity, 0);
  const standaloneFeesZar = Math.max(0, Math.round((result.totalOrderZar - lotsTotalZar) * 100) / 100);

  return (
    <section className="wizard-panel coffee-cost-summary-panel">
      <div className="coffee-cost-header">
        <div>
          <div className="wizard-card-title">{title}</div>
          {description && <p className="wizard-card-copy">{description}</p>}
        </div>
      </div>

      <div className="coffee-cost-table-wrap">
        <table className="coffee-cost-table">
          <thead>
            <tr>
              <th className="coffee-col-name">Coffee</th>
              <th className="coffee-col-bags">Bags</th>
              <th className="coffee-col-avg" title="Average across this order. Individual totals can differ when fees are split per person.">Average price per bag</th>
              <th className="coffee-col-total">Total</th>
            </tr>
          </thead>
          <tbody>
            {result.lotCalcs.map((lot) => (
              <tr key={lot.lotId}>
                <td className="coffee-col-name">
                  <div className="coffee-cost-name">{lot.lotName}</div>
                  <div className="coffee-cost-meta">
                    {formatGrams(lot.gramsPerBag)}/bag · Coffee: {formatZAR(lot.goodsZar)} · Fees: {formatZAR(lot.feesZar)}
                  </div>
                </td>
                <td className="coffee-col-bags num-cell" style={{ fontVariantNumeric: 'tabular-nums' }}>{lot.quantity}</td>
                <td className="coffee-col-avg num-cell" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  <span className="coffee-cost-per-bag">{formatZAR(lot.finalZarPerBag)}</span>
                </td>
                <td className="coffee-col-total num-cell cell-total" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatZAR(lot.totalZar)}
                </td>
              </tr>
            ))}
            {standaloneFeesZar > 0.005 && (
              <tr key="standalone-fees">
                <td className="coffee-col-name">
                  <div className="coffee-cost-name">Standalone &amp; participant fees</div>
                  <div className="coffee-cost-meta">
                    Direct fees not attached to coffee bags
                  </div>
                </td>
                <td className="coffee-col-bags cell-muted">—</td>
                <td className="coffee-col-avg cell-muted">—</td>
                <td className="coffee-col-total num-cell cell-total" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatZAR(standaloneFeesZar)}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="coffee-cost-foot">
              <td className="coffee-col-name cell-total">
                Order total
              </td>
              <td className="coffee-col-bags num-cell" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {totalBags}
              </td>
              <td className="coffee-col-avg num-cell cell-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {totalBags > 0 ? `${formatZAR(result.totalOrderZar / totalBags)} avg` : '—'}
              </td>
              <td className="coffee-col-total num-cell cell-total" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatZAR(result.totalOrderZar)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <style>{`
        .coffee-cost-header {
          margin-bottom: var(--space-3);
        }

        .coffee-cost-table-wrap {
          overflow-x: auto;
        }

        .coffee-col-name {
          text-align: left;
        }

        .coffee-col-bags {
          text-align: center;
          width: 80px;
          font-weight: 600;
        }

        .coffee-col-avg {
          text-align: right;
          width: 150px;
        }

        .coffee-col-total {
          text-align: right;
          width: 120px;
        }

        .cell-total {
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .cell-muted {
          color: var(--color-text-muted);
        }

        .coffee-cost-foot {
          border-top: 2px solid var(--color-border);
          font-weight: 700;
        }
      `}</style>
    </section>
  );
}
