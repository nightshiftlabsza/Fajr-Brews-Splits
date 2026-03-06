import type { Person } from '../types';
import { WORKSPACE_ID } from '../lib/supabase';

// ─── Default Fajr Brews People Directory ─────────────────────
// These are placeholder names. Edit them in the People section of the app.
// See README: Privacy Note on bundled contact data.

export const DEFAULT_PEOPLE: Omit<Person, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    workspaceId: WORKSPACE_ID,
    name: 'Yusuf',
    phone: '+27 82 000 0001',
    email: '',
    note: 'Placeholder — edit in People',
  },
  {
    workspaceId: WORKSPACE_ID,
    name: 'Ahmed',
    phone: '+27 82 000 0002',
    email: '',
    note: 'Placeholder — edit in People',
  },
  {
    workspaceId: WORKSPACE_ID,
    name: 'Fatima',
    phone: '+27 82 000 0003',
    email: '',
    note: 'Placeholder — edit in People',
  },
  {
    workspaceId: WORKSPACE_ID,
    name: 'Omar',
    phone: '+27 82 000 0004',
    email: '',
    note: 'Placeholder — edit in People',
  },
  {
    workspaceId: WORKSPACE_ID,
    name: 'Zainab',
    phone: '+27 82 000 0005',
    email: '',
    note: 'Placeholder — edit in People',
  },
];
