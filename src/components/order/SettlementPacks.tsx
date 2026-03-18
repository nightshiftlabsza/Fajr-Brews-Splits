import { useMemo, useState } from 'react';
import { InvoiceActions } from '../invoice/InvoiceActions';
import { InvoiceView } from '../invoice/InvoiceView';
import { formatZAR } from '../../lib/formatters';
import type { CalculationResult, Order, Person } from '../../types';

interface Props {
  order: Order;
  people: Person[];
  result: CalculationResult;
  title?: string;
  description?: string;
}

export function SettlementPacks({
  order,
  people,
  result,
  title = 'Invoices and sharing',
  description = 'Preview each payment request, then download PDFs or send them out directly from here.',
}: Props) {
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(result.personIds[0] ?? null);

  const personMap = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people],
  );
  const payer = order.payerId ? personMap.get(order.payerId) : undefined;

  return (
    <section className="wizard-panel">
      <div className="wizard-card-header">
        <div>
          <div className="wizard-card-title">{title}</div>
          <p className="wizard-card-copy">{description}</p>
        </div>
      </div>

      <div className="settlement-pack-list">
        {result.personIds.map((personId) => {
          const person = personMap.get(personId);
          const calc = result.personCalcs[personId];
          const payment = order.payments[personId];
          const status = payment?.status || 'unpaid';
          const isExpanded = expandedPersonId === personId;

          if (!person) return null;

          return (
            <div key={personId} className={`settlement-pack ${isExpanded ? 'is-open' : ''}`}>
              <div className="settlement-pack-header">
                <div>
                  <div className="settlement-pack-name">
                    {person.name}
                    {personId === order.payerId && <span className="wizard-inline-meta">Payer</span>}
                  </div>
                  <div className="settlement-pack-copy">
                    {calc.totalGrams}g · {status === 'paid' ? 'Paid' : status === 'partial' ? 'Partial payment recorded' : 'Ready to request payment'}
                  </div>
                </div>

                <div className="settlement-pack-topline">
                  <span className={`pill pill-${status}`}>
                    {status === 'paid' ? 'Paid' : status === 'partial' ? 'Partial' : 'Unpaid'}
                  </span>
                  <strong className="settlement-pack-total">{formatZAR(calc.totalFinal)}</strong>
                </div>
              </div>

              <div className="settlement-pack-actions">
                <InvoiceActions
                  order={order}
                  person={person}
                  payer={payer}
                  calc={calc}
                />
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setExpandedPersonId((current) => (current === personId ? null : personId))}
                >
                  {isExpanded ? 'Hide preview' : 'Preview invoice'}
                </button>
              </div>

              {isExpanded && (
                <div className="settlement-pack-preview">
                  <InvoiceView
                    order={order}
                    person={person}
                    payer={payer}
                    calc={calc}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
