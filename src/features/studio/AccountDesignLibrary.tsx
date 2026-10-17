import { useEffect, useRef, useState } from 'react';
import { DESIGN_PAGE_SIZE, DesignServiceError } from './savedDesigns';
import type { DesignCommand, DesignResult, SavedDesign } from './savedDesigns';
import type { BouquetDesign } from './design';
import { totalStems } from './design';

export type AccountDesignProps = { design: BouquetDesign; onOpen: (design: BouquetDesign) => void };
type Transport = (command: DesignCommand) => Promise<DesignResult>;

// Exported for component tests; no fixture account/transport is wired into app routes.
export function AccountDesignLibrary({ design, onOpen, request }: AccountDesignProps & { request: Transport }) {
  const [rows, setRows] = useState<SavedDesign[]>([]);
  const [selected, setSelected] = useState<SavedDesign | null>(null);
  const [name, setName] = useState('My bouquet');
  const [offset, setOffset] = useState(0);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<{ action: 'open' | 'delete'; row: SavedDesign } | null>(null);
  const lifetime = useRef(0);
  const locked = useRef(false);
  const currentDesign = useRef(design);
  currentDesign.current = design;

  async function perform(command: DesignCommand, apply: (result: DesignResult) => void) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(''); setMessage('');
    const generation = lifetime.current;
    try {
      const result = await request(command);
      if (generation === lifetime.current) apply(result);
    } catch (failure) {
      if (generation === lifetime.current) {
        setError(failure instanceof DesignServiceError ? failure.message : 'Saved designs are temporarily unavailable. Your current bouquet has been kept.');
        if (failure instanceof DesignServiceError && [401, 403].includes(failure.status)) {
          setRows([]); setSelected(null); setConfirmation(null); setName('My bouquet'); setMore(false);
        }
      }
    } finally {
      if (generation === lifetime.current) { locked.current = false; setBusy(false); }
    }
  }
  const load = (page: number) => perform({ action: 'list', offset: page }, result => {
    if ('designs' in result) { setRows(result.designs); setMore(result.hasMore); setOffset(page); setConfirmation(null); }
  });
  useEffect(() => {
    void load(0);
    return () => { lifetime.current++; locked.current = false; };
    // The caller remounts by account UID. The initial request is intentionally once per mount.
  }, []);
  const save = (update: boolean) => {
    if (update && !selected) return;
    const command: DesignCommand = update && selected ? { action: 'update', id: selected.id, revision: selected.revision, name, configuration: design } : { action: 'create', name, configuration: design };
    void perform(command, result => {
      if ('design' in result) { setSelected(result.design); setName(result.design.name); setConfirmation(null); setMessage('Saved to your Customer account. Refresh the list to see the current page.'); }
    });
  };
  const confirm = () => {
    if (!confirmation) return;
    const { action, row } = confirmation;
    const openingDesign = design;
    if (action === 'open') void perform({ action: 'get', id: row.id }, result => {
      if ('design' in result) {
        if (currentDesign.current !== openingDesign) { setError('Your bouquet changed while the account design was loading. Open it again to confirm replacement.'); return; }
        onOpen(result.design.configuration); setSelected(result.design); setName(result.design.name); setConfirmation(null); setMessage('Account design opened in the Studio. Your browser-local saved draft is unchanged.');
      }
    });
    else void perform({ action: 'delete', id: row.id, revision: row.revision }, result => {
      if ('deleted' in result) {
        setRows(current => current.filter(item => item.id !== row.id));
        if (selected?.id === row.id) setSelected(null);
        setConfirmation(null); setMessage('Account design deleted. Your current bouquet and browser-local draft have been kept.');
      }
    });
  };
  return <>
    <label htmlFor="account-design-name">Design name</label>
    <input id="account-design-name" maxLength={80} value={name} disabled={busy} onChange={event => setName(event.target.value)} />
    <div className="draft-actions">
      <button className="button primary" disabled={busy || !name.trim()} onClick={() => save(false)}>Save as new account design</button>
      <button className="button outline" disabled={busy || !selected || !name.trim()} onClick={() => save(true)}>Update opened account design</button>
      <button className="button outline" disabled={busy} onClick={() => void load(offset)}>Refresh saved designs</button>
    </div>
    {selected && <p>Opened: <strong>{selected.name}</strong> · Revision {selected.revision}</p>}
    {busy && <p role="status">Working with your saved designs…</p>}
    {!busy && !rows.length && !error && <p>No designs on this page. Save your bouquet or return to the previous page.</p>}
    <ul className="account-design-list">{rows.map(row => <li key={row.id}>
      <div><strong>{row.name}</strong><p>{totalStems(row.configuration.flowers)} stems · {row.configuration.wrapper} · Revision {row.revision}</p></div>
      <div className="draft-actions"><button className="button outline" disabled={busy} onClick={() => setConfirmation({ action: 'open', row })}>Open {row.name}</button>
        <button className="draft-remove" disabled={busy} onClick={() => setConfirmation({ action: 'delete', row })}>Delete {row.name}</button></div>
    </li>)}</ul>
    {confirmation && <div className="notice" role="group" aria-label="Confirm account design action">
      <p>{confirmation.action === 'open' ? `Replace the current bouquet with “${confirmation.row.name}”? Unsaved Studio edits will be replaced.` : `Delete “${confirmation.row.name}” from your account? This cannot be undone.`}</p>
      <button className="button primary" disabled={busy} onClick={confirm}>{confirmation.action === 'open' ? 'Replace bouquet' : 'Confirm delete'}</button>
      <button className="button outline" disabled={busy} onClick={() => setConfirmation(null)}>Cancel</button>
    </div>}
    <div className="draft-actions"><button className="button outline" disabled={busy || offset === 0} onClick={() => void load(Math.max(0, offset - DESIGN_PAGE_SIZE))}>Previous designs</button>
      <button className="button outline" disabled={busy || !more || offset + DESIGN_PAGE_SIZE > 10000} onClick={() => void load(offset + DESIGN_PAGE_SIZE)}>Next designs</button></div>
    <p role="status" aria-live="polite">{message}</p>{error && <p className="feedback error" role="alert">{error}</p>}
  </>;
}
