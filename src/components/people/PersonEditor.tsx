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

  function setField(key: keyof PersonFormValues) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [key]: e.target.value }));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
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
          <label className="field-label">Name *</label>
          <input
            className="input"
            value={form.name}
            onChange={setField('name')}
            placeholder="Full name"
            autoFocus={autoFocus}
          />
        </div>
        <div className="field">
          <label className="field-label">Phone</label>
          <input
            className="input"
            type="tel"
            value={form.phone}
            onChange={setField('phone')}
            placeholder="+27 82 xxx xxxx"
          />
        </div>
      </div>

      <div className="field">
        <label className="field-label">Email</label>
        <input
          className="input"
          type="email"
          value={form.email}
          onChange={setField('email')}
          placeholder="optional"
        />
      </div>

      <div className="field">
        <label className="field-label">Note</label>
        <textarea
          className="textarea"
          value={form.note}
          onChange={setField('note')}
          placeholder="Optional note"
          rows={3}
        />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => onSave(form)} disabled={saving}>
          {saving ? <span className="spinner" style={{ width: 16, height: 16 }} /> : submitLabel}
        </button>
        <button className="btn btn-ghost" onClick={onCancel} disabled={saving}>
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
