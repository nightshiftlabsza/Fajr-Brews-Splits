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
      <div className="wizard-card-header" style={{ marginBottom: 'var(--space-3)' }}>
        <div>
          <div className="wizard-card-title">{title}</div>
          {description && <p className="wizard-card-copy">{description}</p>}
        </div>
      </div>

      <div className="coffee-cost-table-wrap">
        <table className="coffee-cost-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Coffee</th>
              <th style={{ textAlign: 'center', width: '80px' }}>Bags</th>
              <th style={{ textAlign: 'right', width: '150px' }} title="Average across this order. Individual totals can differ when fees are allocated per person.">Average cost / bag</th>
              <th style={{ textAlign: 'right', width: '120px' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {result.lotCalcs.map((lot) => (
              <tr key={lot.lotId}>
                <td>
                  <div className="coffee-cost-name">{lot.lotName}</div>
                  <div className="coffee-cost-meta">
                    {formatGrams(lot.gramsPerBag)}/bag · Beans: {formatZAR(lot.goodsZar)} · Fees: {formatZAR(lot.feesZar)}
                  </div>
                </td>
                <td style={{ textAlign: 'center', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{lot.quantity}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  <span className="coffee-cost-per-bag">{formatZAR(lot.finalZarPerBag)}</span>
                </td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatZAR(lot.totalZar)}
                </td>
              </tr>
            ))}
            {standaloneFeesZar > 0.005 && (
              <tr key="standalone-fees">
                <td>
                  <div className="coffee-cost-name">Standalone &amp; participant fees</div>
                  <div className="coffee-cost-meta">
                    Direct fees not attached to coffee bags
                  </div>
                </td>
                <td style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>—</td>
                <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>—</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatZAR(standaloneFeesZar)}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--color-border)', fontWeight: 700 }}>
              <td style={{ textAlign: 'left', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Order total
              </td>
              <td style={{ textAlign: 'center', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {totalBags}
              </td>
              <td style={{ textAlign: 'right', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {totalBags > 0 ? `${formatZAR(result.totalOrderZar / totalBags)} avg` : '—'}
              </td>
              <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {formatZAR(result.totalOrderZar)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
