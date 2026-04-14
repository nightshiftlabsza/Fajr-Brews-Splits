import { useMemo, useState } from 'react';
import type { Order, Roaster, RoasterFeatureStatus, RoasterSnapshot } from '../../types';
import { isValidRoasterLogoFile, normalizeRoasterName } from '../../lib/roasters';
import { RoasterAvatar } from './RoasterAvatar';

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;

interface RoasterPickerProps {
  orders: Order[];
  roasters: Roaster[];
  selectedRoasterId: string | null;
  selectedRoasterSnapshot?: RoasterSnapshot | null;
  featureStatus: RoasterFeatureStatus;
  featureMessage?: string | null;
  canManageRoasters: boolean;
  onSelectRoaster: (roaster: Roaster | null) => void;
  onCreateRoaster: (data: { name: string; logoFile?: File | null }) => Promise<Roaster>;
}

export function RoasterPicker({
  orders,
  roasters,
  selectedRoasterId,
  selectedRoasterSnapshot,
  featureStatus,
  featureMessage,
  canManageRoasters,
  onSelectRoaster,
  onCreateRoaster,
}: RoasterPickerProps) {
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createLogoFile, setCreateLogoFile] = useState<File | null>(null);
  const [createError, setCreateError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedRoaster = roasters.find((roaster) => roaster.id === selectedRoasterId) ?? null;
  const selectedRoasterDisplay = selectedRoaster ?? (
    selectedRoasterSnapshot?.name
      ? {
        id: selectedRoasterSnapshot.id ?? 'snapshot',
        name: selectedRoasterSnapshot.name,
        logoUrl: selectedRoasterSnapshot.logoUrl,
      }
      : null
  );
  const creationAvailable = canManageRoasters && (featureStatus === 'ready' || featureStatus === 'empty');
  const pickerDisabled = featureStatus === 'unavailable' || !canManageRoasters;
  const inlineWarning = featureStatus === 'unavailable'
    ? (featureMessage ?? 'Roasters are unavailable until the Supabase roaster migration is applied.')
    : (!canManageRoasters && featureStatus === 'unsupported-for-user')
      ? 'Only workspace members can create or manage saved roasters.'
      : featureMessage ?? '';

  const roasterUsage = useMemo(() => {
    const usage = new Map<string, string>();
    for (const order of orders) {
      if (!order.roasterId) {
        continue;
      }
      const current = usage.get(order.roasterId);
      if (!current || order.orderDate > current) {
        usage.set(order.roasterId, order.orderDate);
      }
    }
    return usage;
  }, [orders]);

  const visibleRoasters = useMemo(() => {
    const normalizedSearch = normalizeRoasterName(search);
    return [...roasters]
      .filter((roaster) => (
        !normalizedSearch ||
        normalizeRoasterName(roaster.name).includes(normalizedSearch)
      ))
      .sort((left, right) => {
        const leftUsed = roasterUsage.get(left.id) ?? '';
        const rightUsed = roasterUsage.get(right.id) ?? '';
        if (leftUsed !== rightUsed) {
          return rightUsed.localeCompare(leftUsed);
        }
        return left.name.localeCompare(right.name);
      });
  }, [roasters, roasterUsage, search]);

  const duplicateMatch = useMemo(() => {
    const normalizedCreateName = normalizeRoasterName(createName);
    if (!normalizedCreateName) {
      return null;
    }

    return roasters.find((roaster) => normalizeRoasterName(roaster.name) === normalizedCreateName) ?? null;
  }, [createName, roasters]);

  function handleSelectChange(nextRoasterId: string) {
    const roaster = roasters.find((candidate) => candidate.id === nextRoasterId) ?? null;
    onSelectRoaster(roaster);
  }

  function handleLogoChange(file: File | null) {
    if (!file) {
      setCreateLogoFile(null);
      setCreateError('');
      return;
    }

    if (!isValidRoasterLogoFile(file)) {
      setCreateError('Logo must be a PNG, JPG, WEBP, or SVG file.');
      return;
    }

    if (file.size > MAX_LOGO_SIZE_BYTES) {
      setCreateError('Logo must be smaller than 2MB.');
      return;
    }

    setCreateError('');
    setCreateLogoFile(file);
  }

  async function handleCreateRoaster() {
    const trimmedName = createName.trim().replace(/\s+/g, ' ');
    if (!trimmedName) {
      setCreateError('Roaster name is required.');
      return;
    }

    if (duplicateMatch) {
      setCreateError(`"${duplicateMatch.name}" already exists. Select the saved roaster instead.`);
      return;
    }

    setSubmitting(true);
    setCreateError('');

    try {
      const roaster = await onCreateRoaster({
        name: trimmedName,
        logoFile: createLogoFile,
      });
      onSelectRoaster(roaster);
      setCreateName('');
      setCreateLogoFile(null);
      setCreateOpen(false);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to save the roaster.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="field">
      <label className="field-label" htmlFor="roaster-search">Roaster</label>

      <div className="roaster-picker-shell">
        <div className="roaster-picker-controls">
          <input
            id="roaster-search"
            className="input"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search saved roasters"
          />
          <select
            className="select"
            value={selectedRoasterId ?? ''}
            onChange={(event) => handleSelectChange(event.target.value)}
            aria-label="Select roaster"
            disabled={pickerDisabled}
          >
            <option value="">No roaster selected</option>
            {visibleRoasters.map((roaster) => (
              <option key={roaster.id} value={roaster.id}>
                {roaster.name}
              </option>
            ))}
          </select>
          {canManageRoasters && (
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={() => setCreateOpen((current) => !current)}
              disabled={!creationAvailable}
            >
              {createOpen ? 'Close' : 'Add roaster'}
            </button>
          )}
        </div>

        {selectedRoasterDisplay && (
          <div className="roaster-selected-card">
            <RoasterAvatar
              name={selectedRoasterDisplay.name}
              logoUrl={selectedRoasterDisplay.logoUrl}
              size={40}
            />
            <div>
              <div className="roaster-selected-name">{selectedRoasterDisplay.name}</div>
              <div className="field-hint">
                {selectedRoaster
                  ? 'This roaster will be saved on the order separately from the order name.'
                  : 'This order still keeps its saved roaster snapshot even while live roasters are unavailable.'}
              </div>
            </div>
          </div>
        )}

        {inlineWarning && <div className="alert alert-warning">{inlineWarning}</div>}

        {createOpen && (
          <div className="roaster-create-panel">
            <div className="wizard-card-grid">
              <div className="field">
                <label className="field-label" htmlFor="create-roaster-name">Roaster name</label>
                <input
                  id="create-roaster-name"
                  className="input"
                  type="text"
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  placeholder="e.g. Father Coffee"
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="create-roaster-logo">Roaster logo</label>
                <input
                  id="create-roaster-logo"
                  className="input"
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(event) => handleLogoChange(event.target.files?.[0] ?? null)}
                />
                <span className="field-hint">
                  Optional. PNG, JPG, WEBP, or SVG up to 2MB.
                </span>
              </div>
            </div>

            {createLogoFile && (
              <div className="roaster-create-file">
                Logo ready: <strong>{createLogoFile.name}</strong>
              </div>
            )}

            {duplicateMatch && (
              <div className="roaster-duplicate-note">
                <span className="field-hint">
                  A saved roaster named <strong>{duplicateMatch.name}</strong> already exists.
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={() => {
                    onSelectRoaster(duplicateMatch);
                    setCreateOpen(false);
                    setCreateError('');
                  }}
                >
                  Use existing
                </button>
              </div>
            )}

            {createError && <div className="alert alert-warning">{createError}</div>}

            <div className="wizard-inline-actions">
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => void handleCreateRoaster()}
                disabled={submitting || !creationAvailable}
              >
                {submitting ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Save roaster'}
              </button>
            </div>
          </div>
        )}
      </div>

      <span className="field-hint">
        Reuse a saved roaster or add a new one here so future orders can pick it again instantly.
      </span>
    </div>
  );
}
