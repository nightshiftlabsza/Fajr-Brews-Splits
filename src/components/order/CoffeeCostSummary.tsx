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
  description = 'Each coffee shows its saved final cost with allocated fees included.',
}: Props) {
  return (
    <section className="wizard-panel">
      <div className="wizard-card-header">
        <div>
          <div className="wizard-card-title">{title}</div>
          <p className="wizard-card-copy">{description}</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {result.lotCalcs.map((lot) => (
          <div
            key={lot.lotId}
            className="card card-padded"
            style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap' }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{lot.lotName}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                {lot.quantity} x {formatGrams(lot.gramsPerBag)} bag · {formatGrams(lot.totalGrams)} total
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', marginTop: 'var(--space-3)', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                <span>Beans: {formatZAR(lot.goodsZar)}</span>
                <span>Allocated fees: {formatZAR(lot.feesZar)}</span>
                <span><strong>{formatZAR(lot.finalZarPerBag)}</strong> per bag</span>
              </div>
            </div>

            <div style={{ textAlign: 'right', minWidth: 140 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                Final coffee total
              </div>
              <div style={{ fontWeight: 800, fontSize: '1.125rem', color: 'var(--color-text-primary)', marginTop: 6 }}>
                {formatZAR(lot.totalZar)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
