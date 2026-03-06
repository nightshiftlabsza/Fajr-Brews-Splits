import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import type { CoffeeLot, ShareLine, Order } from '../../types';
import { remainingGrams } from '../../lib/calculations';
import { formatGrams } from '../../lib/formatters';

function genId() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

interface Props {
  order: Order;
}

interface LotFormState {
  name: string;
  foreignPricePerBag: string;
  gramsPerBag: string;
  quantity: string;
}

const emptyLotForm: LotFormState = {
  name: '',
  foreignPricePerBag: '',
  gramsPerBag: '250',
  quantity: '1',
};

export function CoffeeLotsSection({ order }: Props) {
  const { people, updateOrder } = useAppStore();
  const [editingLotId, setEditingLotId] = useState<string | 'new' | null>(null);
  const [lotForm, setLotForm] = useState<LotFormState>(emptyLotForm);
  const [formError, setFormError] = useState('');

  function openNew() {
    setLotForm(emptyLotForm);
    setFormError('');
    setEditingLotId('new');
  }

  function openEdit(lot: CoffeeLot) {
    setLotForm({
      name: lot.name,
      foreignPricePerBag: String(lot.foreignPricePerBag),
      gramsPerBag: String(lot.gramsPerBag),
      quantity: String(lot.quantity),
    });
    setFormError('');
    setEditingLotId(lot.id);
  }

  function saveLot() {
    const gpb = parseInt(lotForm.gramsPerBag, 10);
    const qty = parseInt(lotForm.quantity, 10);
    const price = parseFloat(lotForm.foreignPricePerBag);

    if (!lotForm.name.trim()) return setFormError('Coffee name is required.');
    if (!Number.isInteger(gpb) || gpb < 1) return setFormError('Grams per bag must be an integer ≥ 1.');
    if (!Number.isInteger(qty) || qty < 1) return setFormError('Quantity must be an integer ≥ 1.');
    if (isNaN(price) || price <= 0) return setFormError('Foreign price must be > 0.');
    setFormError('');

    let updatedLots: CoffeeLot[];

    if (editingLotId === 'new') {
      const newLot: CoffeeLot = {
        id: genId(),
        name: lotForm.name.trim(),
        foreignPricePerBag: price,
        gramsPerBag: gpb,
        quantity: qty,
        shares: [],
      };
      updatedLots = [...order.lots, newLot];
    } else {
      updatedLots = order.lots.map((l) => {
        if (l.id !== editingLotId) return l;
        // If grams or qty changed, clear shares (they'd be invalid)
        const newTotal = gpb * qty;
        const oldTotal = l.gramsPerBag * l.quantity;
        return {
          ...l,
          name: lotForm.name.trim(),
          foreignPricePerBag: price,
          gramsPerBag: gpb,
          quantity: qty,
          shares: newTotal !== oldTotal ? [] : l.shares,
        };
      });
    }

    updateOrder(order.id, { lots: updatedLots });
    setEditingLotId(null);
  }

  function deleteLot(lotId: string) {
    updateOrder(order.id, { lots: order.lots.filter((l) => l.id !== lotId) });
  }

  function updateShares(lotId: string, shares: ShareLine[]) {
    updateOrder(order.id, {
      lots: order.lots.map((l) => (l.id === lotId ? { ...l, shares } : l)),
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Lot list */}
      {order.lots.length === 0 && (
        <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
          <div className="empty-state-icon">☕</div>
          <h3>No coffee lots yet</h3>
          <p>Add the coffees included in this order.</p>
        </div>
      )}

      {order.lots.map((lot) => (
        <LotCard
          key={lot.id}
          lot={lot}
          people={people}
          isEditing={editingLotId === lot.id}
          lotForm={lotForm}
          formError={formError}
          setLotForm={setLotForm}
          onEdit={() => openEdit(lot)}
          onSave={saveLot}
          onCancel={() => setEditingLotId(null)}
          onDelete={() => deleteLot(lot.id)}
          onSharesChange={(shares) => updateShares(lot.id, shares)}
        />
      ))}

      {/* New lot form */}
      {editingLotId === 'new' && (
        <div className="card">
          <div className="card-padded">
            <div className="section-label" style={{ marginBottom: 'var(--space-4)' }}>New coffee lot</div>
            <LotForm
              form={lotForm}
              error={formError}
              onChange={setLotForm}
              onSave={saveLot}
              onCancel={() => setEditingLotId(null)}
            />
          </div>
        </div>
      )}

      {editingLotId === null && (
        <button className="btn btn-secondary" onClick={openNew}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Add coffee lot
        </button>
      )}
    </div>
  );
}

// ─── Lot Card ─────────────────────────────────────────────────

interface LotCardProps {
  lot: CoffeeLot;
  people: import('../../types').Person[];
  isEditing: boolean;
  lotForm: LotFormState;
  formError: string;
  setLotForm: (f: LotFormState) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onSharesChange: (shares: ShareLine[]) => void;
}

function LotCard({ lot, people, isEditing, lotForm, formError, setLotForm, onEdit, onSave, onCancel, onDelete, onSharesChange }: LotCardProps) {
  const totalGrams = lot.gramsPerBag * lot.quantity;
  const rem = remainingGrams(lot);
  const balanced = rem === 0;

  return (
    <div className="card">
      <div className="card-padded" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {isEditing ? (
          <>
            <div className="section-label">Edit lot</div>
            <LotForm form={lotForm} error={formError} onChange={setLotForm} onSave={onSave} onCancel={onCancel} />
          </>
        ) : (
          <>
            {/* Lot header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-primary)' }}>
                  {lot.name}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {lot.quantity} × {formatGrams(lot.gramsPerBag)} bag &nbsp;·&nbsp; {formatGrams(totalGrams)} total &nbsp;·&nbsp; {lot.foreignPricePerBag} /bag
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
                <button className="btn btn-ghost btn-sm" onClick={onEdit}>Edit</button>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-unpaid)' }} onClick={onDelete}>Delete</button>
              </div>
            </div>

            {/* Shares manager */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                <div className="section-label" style={{ marginBottom: 0 }}>Share allocation</div>
                <GramsBadge remaining={rem} total={totalGrams} />
              </div>

              <SharesManager
                lot={lot}
                people={people}
                onChange={onSharesChange}
              />
            </div>

            {!balanced && lot.shares.length > 0 && (
              <div className="alert alert-warning" style={{ fontSize: '0.8125rem' }}>
                {rem > 0 ? `${rem}g unallocated` : `${Math.abs(rem)}g over-allocated`} — shares must total exactly {formatGrams(totalGrams)}.
              </div>
            )}
            {balanced && lot.shares.length > 0 && (
              <div className="alert alert-success" style={{ fontSize: '0.8125rem' }}>
                ✓ All {formatGrams(totalGrams)} allocated
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Lot Form ─────────────────────────────────────────────────

interface LotFormProps {
  form: LotFormState;
  error: string;
  onChange: (f: LotFormState) => void;
  onSave: () => void;
  onCancel: () => void;
}

function LotForm({ form, error, onChange, onSave, onCancel }: LotFormProps) {
  function set(key: keyof LotFormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...form, [key]: e.target.value });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div className="field">
        <label className="field-label">Coffee name</label>
        <input className="input" value={form.name} onChange={set('name')} placeholder="e.g. Ethiopian Yirgacheffe" autoFocus />
      </div>
      <div className="grid-2">
        <div className="field">
          <label className="field-label">Foreign list price per bag</label>
          <input className="input" type="number" value={form.foreignPricePerBag} onChange={set('foreignPricePerBag')} placeholder="e.g. 18.50" step="0.01" min="0.01" />
          <span className="field-hint">Original currency (EUR, USD, etc.)</span>
        </div>
        <div className="field">
          <label className="field-label">Grams per bag</label>
          <input className="input" type="number" value={form.gramsPerBag} onChange={set('gramsPerBag')} placeholder="250" step="1" min="1" />
          <span className="field-hint">Integer grams</span>
        </div>
      </div>
      <div className="field" style={{ maxWidth: 200 }}>
        <label className="field-label">Quantity (bags)</label>
        <input className="input" type="number" value={form.quantity} onChange={set('quantity')} placeholder="1" step="1" min="1" />
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <button className="btn btn-primary" onClick={onSave}>Save lot</button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Shares Manager ───────────────────────────────────────────

interface SharesManagerProps {
  lot: CoffeeLot;
  people: import('../../types').Person[];
  onChange: (shares: ShareLine[]) => void;
}

function SharesManager({ lot, people, onChange }: SharesManagerProps) {
  const totalGrams = lot.gramsPerBag * lot.quantity;
  const shares = lot.shares;

  function addShare() {
    const usedIds = shares.map((s) => s.personId);
    const available = people.filter((p) => !usedIds.includes(p.id));
    if (available.length === 0) return;
    const rem = remainingGrams(lot);
    const newShare: ShareLine = {
      id: genId(),
      personId: available[0].id,
      shareGrams: Math.max(0, rem),
    };
    onChange([...shares, newShare]);
  }

  function updateShare(shareId: string, field: 'personId' | 'shareGrams', value: string) {
    onChange(shares.map((s) => {
      if (s.id !== shareId) return s;
      if (field === 'shareGrams') return { ...s, shareGrams: parseInt(value, 10) || 0 };
      return { ...s, personId: value };
    }));
  }

  function removeShare(shareId: string) {
    onChange(shares.filter((s) => s.id !== shareId));
  }

  function splitEqually() {
    if (people.length === 0) return;
    const n = people.length;
    const base = Math.floor(totalGrams / n);
    const remainder = totalGrams - base * n;
    const newShares: ShareLine[] = people.map((p, i) => ({
      id: shares.find((s) => s.personId === p.id)?.id || genId(),
      personId: p.id,
      shareGrams: base + (i === 0 ? remainder : 0),
    }));
    onChange(newShares);
  }

  function assignRemainderToLast() {
    if (shares.length === 0) return;
    const rem = remainingGrams(lot);
    const last = shares[shares.length - 1];
    onChange(shares.map((s) =>
      s.id === last.id ? { ...s, shareGrams: Math.max(0, s.shareGrams + rem) } : s
    ));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {shares.map((share, idx) => (
        <div key={share.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <select
            className="select"
            value={share.personId}
            onChange={(e) => updateShare(share.id, 'personId', e.target.value)}
            style={{ flex: 1 }}
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}
                disabled={shares.some((s) => s.id !== share.id && s.personId === p.id)}
              >{p.name}</option>
            ))}
          </select>
          <input
            className="input"
            type="number"
            value={share.shareGrams || ''}
            onChange={(e) => updateShare(share.id, 'shareGrams', e.target.value)}
            style={{ width: 90, flexShrink: 0 }}
            min="1"
            step="1"
            placeholder="g"
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', flexShrink: 0 }}>g</span>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => removeShare(share.id)}
            title="Remove"
            style={{ flexShrink: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        {shares.length < people.length && (
          <button className="btn btn-secondary btn-sm" onClick={addShare}>
            + Add person
          </button>
        )}
        {people.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={splitEqually}>
            Split equally
          </button>
        )}
        {shares.length > 0 && remainingGrams(lot) !== 0 && (
          <button className="btn btn-ghost btn-sm" onClick={assignRemainderToLast}>
            Assign remainder
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Grams Badge ──────────────────────────────────────────────

function GramsBadge({ remaining, total }: { remaining: number; total: number }) {
  const balanced = remaining === 0;
  const over = remaining < 0;

  return (
    <span className={`grams-badge ${balanced ? 'grams-badge-ok' : over ? 'grams-badge-error' : 'grams-badge-warn'}`}>
      {balanced ? `✓ ${formatGrams(total)}` : over ? `${formatGrams(Math.abs(remaining))} over` : `${formatGrams(remaining)} left`}
    </span>
  );
}
