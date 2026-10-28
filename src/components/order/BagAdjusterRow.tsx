import type { Bag, BagSplitMode, Person } from '../../types';
import { formatGrams } from '../../lib/formatters';
import { Icon } from '../ui/Icon';

export interface BagAdjusterRowProps {
  bag: Bag;
  bagIndex: number;
  totalBagsInLot: number;
  gramsPerBag: number;
  people: Person[];
  personNameMap: Record<string, string>;
  onAssignFull: (personId: string) => void;
  onSplitEqual: (personIds: string[]) => void;
  onOpenCustomSplit: () => void;
  onRemoveBag: () => void;
  onAddNewPerson: () => void;
}

export function BagAdjusterRow({
  bag,
  bagIndex,
  totalBagsInLot,
  gramsPerBag,
  people,
  onAssignFull,
  onSplitEqual,
  onOpenCustomSplit,
  onRemoveBag,
  onAddNewPerson,
}: BagAdjusterRowProps) {
  const currentBuyerIds = bag.buyers.map((b) => b.personId).filter(Boolean);

  function handleModeChange(newMode: BagSplitMode) {
    if (newMode === 'full') {
      const firstBuyer = currentBuyerIds[0] || people[0]?.id || '';
      onAssignFull(firstBuyer);
    } else if (newMode === 'equal') {
      const splitBuyers = currentBuyerIds.length >= 2 ? currentBuyerIds : people.slice(0, 2).map((p) => p.id);
      onSplitEqual(splitBuyers);
    } else if (newMode === 'custom') {
      onOpenCustomSplit();
    }
  }

  function handleTogglePerson(personId: string) {
    if (bag.splitMode === 'full' || bag.splitMode === 'unassigned') {
      if (currentBuyerIds.includes(personId)) {
        onAssignFull('');
      } else {
        onAssignFull(personId);
      }
    } else {
      // Split mode
      let nextIds: string[];
      if (currentBuyerIds.includes(personId)) {
        nextIds = currentBuyerIds.filter((id) => id !== personId);
      } else {
        nextIds = [...currentBuyerIds, personId];
      }
      if (nextIds.length === 1) {
        onAssignFull(nextIds[0]);
      } else {
        onSplitEqual(nextIds);
      }
    }
  }

  return (
    <div className="bag-adjuster-card">
      <div className="bag-adjuster-top">
        <div className="bag-adjuster-title-group">
          <span className="bag-index-badge num-cell">
            Bag {bagIndex + 1} ({formatGrams(gramsPerBag)})
          </span>
          <div className="bag-mode-pills" role="radiogroup" aria-label={`Bag ${bagIndex + 1} split mode`}>
            <button
              type="button"
              className={`bag-mode-pill ${bag.splitMode === 'full' || bag.splitMode === 'unassigned' ? 'is-active' : ''}`}
              onClick={() => handleModeChange('full')}
            >
              Whole Bag
            </button>
            <button
              type="button"
              className={`bag-mode-pill ${bag.splitMode === 'equal' ? 'is-active' : ''}`}
              onClick={() => handleModeChange('equal')}
            >
              Equal Split
            </button>
            <button
              type="button"
              className={`bag-mode-pill ${bag.splitMode === 'custom' ? 'is-active' : ''}`}
              onClick={() => handleModeChange('custom')}
            >
              Custom Grams
            </button>
          </div>
        </div>

        <div className="bag-adjuster-actions">
          {bag.splitMode === 'custom' && (
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={onOpenCustomSplit}
            >
              Edit Grams
            </button>
          )}
          {totalBagsInLot > 1 && (
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-danger-text"
              onClick={onRemoveBag}
              aria-label={`Remove Bag ${bagIndex + 1}`}
              title="Remove this bag"
            >
              <Icon name="close" size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="bag-adjuster-buyers">
        {people.map((p) => {
          const isSelected = currentBuyerIds.includes(p.id);
          const customGrams = bag.buyers.find((b) => b.personId === p.id)?.grams;
          return (
            <button
              key={p.id}
              type="button"
              className={`buyer-chip ${isSelected ? 'is-selected' : ''}`}
              onClick={() => handleTogglePerson(p.id)}
            >
              <Icon name={isSelected ? 'check' : 'plus'} size={12} />
              <span>{p.name}</span>
              {isSelected && bag.splitMode === 'custom' && customGrams !== undefined && (
                <span className="buyer-chip-grams num-cell">
                  ({customGrams}g)
                </span>
              )}
            </button>
          );
        })}
        <button
          type="button"
          className="buyer-chip buyer-chip-add"
          onClick={onAddNewPerson}
        >
          <Icon name="plus" size={12} />
          <span>Add person</span>
        </button>
      </div>

      <style>{`
        .bag-adjuster-title-group {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .bag-adjuster-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .buyer-chip-grams {
          font-size: 0.6875rem;
          opacity: 0.85;
        }
      `}</style>
    </div>
  );
}
