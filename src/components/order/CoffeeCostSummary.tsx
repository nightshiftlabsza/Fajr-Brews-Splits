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
              <th style={{ textAlign: 'right', width: '130px' }}>Cost / bag</th>
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
                <td style={{ textAlign: 'center', fontWeight: 600 }}>{lot.quantity}</td>
                <td style={{ textAlign: 'right' }}>
                  <span className="coffee-cost-per-bag">{formatZAR(lot.finalZarPerBag)}</span>
                </td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {formatZAR(lot.totalZar)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
