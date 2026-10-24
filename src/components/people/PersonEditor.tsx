import { useEffect, useState } from 'react';

export interface PersonFormValues {
  name: string;
  phone: string;
  email: string;
  note: string;
}

interface PersonEditorProps {
  initialValues?: Partial<PersonFormValues>;
  title?: string;
  description?: string;
  error?: string;
  saving?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  autoFocus?: boolean;
  onSave: (values: PersonFormValues) => void | Promise<void>;
  onCancel: () => void;
}

const emptyValues: PersonFormValues = {
  name: '',
  phone: '',
  email: '',
  note: '',
};

export function PersonEditor({
  initialValues,
  title,
  description,
  error,
  saving = false,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  autoFocus = true,
  onSave,
  onCancel,
}: PersonEditorProps) {
  const [form, setForm] = useState<PersonFormValues>({
    ...emptyValues,
    ...initialValues,
  });

  useEffect(() => {
    setForm({
      ...emptyValues,
      ...initialValues,
    });
  }, [initialValues]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) {
        e.preventDefault();
        onCancel();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saving, onCancel]);

  function setField(key: keyof PersonFormValues) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [key]: e.target.value }));
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!saving) {
      void onSave(form);
    }
  }

  return (
    <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {title && (
        <div>
          <div className="wizard-card-title">{title}</div>
          {description && (
            <p className="wizard-card-copy" style={{ marginTop: 'var(--space-2)' }}>
              {description}
            </p>
          )}
        </div>
      )}

      <div className="grid-2">
        <div className="field">
          <label className="field-label" htmlFor="person-form-name">Name *</label>
          <input
            id="person-form-name"
            className="input"
            value={form.name}
            onChange={setField('name')}
            placeholder="Full name"
            autoFocus={autoFocus}
            required
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="person-form-phone">Phone</label>
          <input
            id="person-form-phone"
            className="input"
            type="tel"
            value={form.phone}
            onChange={setField('phone')}
            placeholder="+27 82 xxx xxxx"
          />
        </div>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="person-form-email">Email</label>
        <input
          id="person-form-email"
          className="input"
          type="email"
          value={form.email}
          onChange={setField('email')}
          placeholder="optional"
        />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="person-form-note">Note</label>
        <textarea
          id="person-form-note"
          className="textarea"
          value={form.note}
          onChange={setField('note')}
          placeholder="Optional note"
          rows={3}
        />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
          {cancelLabel}
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? <span className="spinner" style={{ width: 16, height: 16 }} /> : submitLabel}
        </button>
      </div>
    </form>
  );
}
