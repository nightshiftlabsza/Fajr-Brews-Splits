import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import type { Person } from '../../types';

interface PersonForm {
  name: string;
  phone: string;
  email: string;
  note: string;
}

const emptyForm: PersonForm = { name: '', phone: '', email: '', note: '' };

export function PeoplePage() {
  const { people, addPerson, updatePerson, deletePerson } = useAppStore();
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<PersonForm>(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [search, setSearch] = useState('');

  const filtered = people.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.phone && p.phone.includes(search)) ||
    (p.email && p.email.toLowerCase().includes(search.toLowerCase()))
  );

  function openNew() {
    setForm(emptyForm);
    setError('');
    setEditingId('new');
  }

  function openEdit(person: Person) {
    setForm({ name: person.name, phone: person.phone || '', email: person.email || '', note: person.note || '' });
    setError('');
    setEditingId(person.id);
  }

  async function handleSave() {
    if (!form.name.trim()) return setError('Name is required.');
    setError('');
    setSaving(true);
    try {
      if (editingId === 'new') {
        await addPerson({ name: form.name.trim(), phone: form.phone || undefined, email: form.email || undefined, note: form.note || undefined });
      } else if (editingId) {
        await updatePerson(editingId, { name: form.name.trim(), phone: form.phone || undefined, email: form.email || undefined, note: form.note || undefined });
      }
      setEditingId(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remove ${name} from the directory?`)) return;
    setDeleteError('');
    try {
      await deletePerson(id);
      if (editingId === id) setEditingId(null);
    } catch (e) {
      setDeleteError(String(e));
    }
  }

  return (
    <div className="page-container">
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ marginBottom: 4 }}>People</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          Shared Fajr Brews directory — visible to all workspace members.
        </p>
      </div>

      {/* Search + add */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
        <input
          className="input"
          type="search"
          placeholder="Search by name, phone, or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />
        <button className="btn btn-primary" onClick={openNew}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
          Add person
        </button>
      </div>

      {/* New person form */}
      {editingId === 'new' && (
        <div className="card card-padded" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="section-label" style={{ marginBottom: 'var(--space-4)' }}>New person</div>
          <PersonForm form={form} error={error} saving={saving} onChange={setForm} onSave={handleSave} onCancel={() => setEditingId(null)} />
        </div>
      )}

      {deleteError && (
        <div className="alert alert-error" style={{ marginBottom: 'var(--space-3)' }}>{deleteError}</div>
      )}

      {/* People list */}
      {filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">👥</div>
          <h3>{search ? 'No results' : 'No people yet'}</h3>
          <p>{search ? `No match for "${search}"` : 'Add the Fajr Brews group members.'}</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {filtered.map((person) => (
          <div key={person.id} className="card">
            {editingId === person.id ? (
              <div className="card-padded">
                <div className="section-label" style={{ marginBottom: 'var(--space-4)' }}>Edit — {person.name}</div>
                <PersonForm form={form} error={error} saving={saving} onChange={setForm} onSave={handleSave} onCancel={() => setEditingId(null)} />
              </div>
            ) : (
              <div className="card-padded" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                <div style={{
                  width: 42, height: 42, borderRadius: '50%',
                  background: 'var(--color-accent-light)',
                  color: 'var(--color-accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '1rem', flexShrink: 0,
                }}>
                  {person.name[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text-primary)' }}>
                    {person.name}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {[person.phone, person.email].filter(Boolean).join(' · ') || 'No contact details'}
                  </div>
                  {person.note && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2, fontStyle: 'italic' }}>
                      {person.note}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(person)}>Edit</button>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--color-unpaid)' }}
                    onClick={() => handleDelete(person.id, person.name)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface PersonFormProps {
  form: PersonForm;
  error: string;
  saving: boolean;
  onChange: (f: PersonForm) => void;
  onSave: () => void;
  onCancel: () => void;
}

function PersonForm({ form, error, saving, onChange, onSave, onCancel }: PersonFormProps) {
  function set(key: keyof PersonForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange({ ...form, [key]: e.target.value });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div className="grid-2">
        <div className="field">
          <label className="field-label">Name *</label>
          <input className="input" value={form.name} onChange={set('name')} placeholder="Full name" autoFocus />
        </div>
        <div className="field">
          <label className="field-label">Phone</label>
          <input className="input" type="tel" value={form.phone} onChange={set('phone')} placeholder="+27 82 xxx xxxx" />
        </div>
      </div>
      <div className="field">
        <label className="field-label">Email</label>
        <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="optional" />
      </div>
      <div className="field">
        <label className="field-label">Note</label>
        <input className="input" value={form.note} onChange={set('note')} placeholder="Optional note" />
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <button className="btn btn-primary" onClick={onSave} disabled={saving}>
          {saving ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Save'}
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
