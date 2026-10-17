import { Component, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Minus, Plus, Rotate3D, Save, FolderOpen, RotateCcw, Trash2 } from 'lucide-react';
import BouquetPreview from '../three/BouquetPreview';
import { changeStem, colorName, defaultDesign, flowerKinds, flowerPalette, MAX_STEMS, ribbons, totalStems, wrappers } from './design';
import type { BouquetDesign, FlowerKind } from './design';
import { clearDraft, DRAFT_KEY, loadDraft, saveDraft } from './drafts';
import AccountDesigns from './AccountDesigns';

const initialColors: Record<FlowerKind, string> = {
  Tulip: flowerPalette.Tulip.Pink, Daisy: flowerPalette.Daisy.White,
  Sunflower: flowerPalette.Sunflower.Yellow, Gerbera: flowerPalette.Gerbera.Pink,
  Rose: flowerPalette.Rose.Red, Lily: flowerPalette.Lily.White,
};

class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <PreviewUnavailable /> : this.props.children;
  }
}

function PreviewUnavailable() {
  return <div className="viewer-unavailable" role="status">3D preview is unavailable in this browser. You can still customize your bouquet and save a preview draft below.</div>;
}

export default function Studio() {
  const [design, setDesign] = useState(defaultDesign);
  const [kind, setKind] = useState<FlowerKind>('Tulip');
  const [selected, setSelected] = useState(initialColors);
  const [stored, setStored] = useState(() => loadDraft());
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const total = totalStems(design.flowers);
  const selectedCount = design.flowers.find(f => f.kind === kind && f.color === selected[kind])?.count ?? 0;
  const savedAt = stored.ok ? stored.value?.savedAt : undefined;

  useEffect(() => {
    const refresh = (event: StorageEvent) => {
      if (event.key === DRAFT_KEY || event.key === null) {
        setStored(loadDraft());
        setError('');
        setNotice('The local draft changed in another tab. Reopen it to use that version. Your current bouquet has not changed.');
      }
    };
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, []);

  const save = () => {
    const result = saveDraft(design);
    setError(result.ok ? '' : result.error);
    setNotice(result.ok ? 'Preview draft saved in this browser. It is not linked to an account.' : '');
    // A failed write must not erase information about an existing stored draft.
    if (result.ok) setStored(result);
  };
  const reopen = () => {
    const result = loadDraft();
    setStored(result);
    setError(result.ok ? '' : result.error);
    setNotice('');
    if (!result.ok) return;
    if (!result.value) { setNotice('There is no preview draft saved in this browser yet.'); return; }
    setDesign(result.value.design);
    setNotice('Preview draft reopened. Flowers, colors, wrapper, ribbon and message card have been restored.');
  };
  const reset = () => {
    setDesign(defaultDesign()); setKind('Tulip'); setSelected(initialColors); setError('');
    setNotice('Bouquet reset to the starting design. Your saved preview draft is kept until you replace or remove it.');
  };
  const discard = () => {
    const result = clearDraft();
    setError(result.ok ? '' : result.error);
    setNotice(result.ok ? 'Saved preview draft removed from this browser. Your current bouquet has not changed.' : '');
    if (result.ok) setStored(result);
  };

  return <main className="interior studio-page">
    <div className="center studio-intro">
      <span className="pill">♡ YOUR BOUQUET, YOUR WAY</span>
      <h1>Your own <em>3D Bloom Studio</em></h1>
      <p className="subheading">Drag to rotate • Scroll to zoom • Mix up to 30 handmade stems</p>
    </div>
    <div className="builder">
        <div className="viewer">
          <div className="viewer-head"><span>3D prototype • interactive flower arrangement</span><Rotate3D size={19} /></div>
          <PreviewBoundary><BouquetPreview flowers={design.flowers} wrapper={design.wrapper} ribbon={design.ribbon} fallback={<PreviewUnavailable />} /></PreviewBoundary>
          <div className="viewer-footer"><span>{total} / {MAX_STEMS} stems</span><span>Visual prototype — not final fuzzy-wire models</span></div>
        </div>
      <aside className="custom-panel" aria-label="Bouquet customization">
        <p className="eyebrow">MAKE IT YOURS</p><h2>Customize your bouquet</h2>
        <span id="flower-label" className="control-label">1. Choose a flower</span>
        <div className="flower-buttons" role="group" aria-labelledby="flower-label">{flowerKinds.map(flower => <button className={flower === kind ? 'selected' : ''} aria-pressed={flower === kind} onClick={() => setKind(flower)} key={flower}>{flower}</button>)}</div>
        <span id="color-label" className="control-label">2. Pick your color</span>
        <div className="swatches" role="group" aria-labelledby="color-label">{Object.entries(flowerPalette[kind]).map(([name, hex]) => <button key={hex} onClick={() => setSelected(current => ({ ...current, [kind]: hex }))} className={selected[kind] === hex ? 'active' : ''} style={{ background: hex }} aria-label={`${name} ${kind}`} aria-pressed={selected[kind] === hex} />)}</div>
        <span className="control-label">3. Add stems</span>
        <div className="counter">
          <button onClick={() => setDesign(current => changeStem(current, kind, selected[kind], -1))} disabled={selectedCount === 0} aria-label="Remove selected stem"><Minus size={17} /></button>
          <span aria-live="polite">{total} stems total</span>
          <button onClick={() => setDesign(current => changeStem(current, kind, selected[kind], 1))} disabled={total >= MAX_STEMS} aria-label="Add selected stem"><Plus size={17} /></button>
        </div>
        {total === MAX_STEMS && <p className="stem-limit" role="status">30-stem maximum reached. Remove a stem to add another.</p>}
        <label htmlFor="wrapper">4. Wrapper style</label>
        <select id="wrapper" value={design.wrapper} onChange={event => setDesign(current => ({ ...current, wrapper: event.target.value as BouquetDesign['wrapper'] }))}>{wrappers.map(wrapper => <option key={wrapper}>{wrapper}</option>)}</select>
        <label htmlFor="ribbon">5. Ribbon</label>
        <select id="ribbon" value={design.ribbon} onChange={event => setDesign(current => ({ ...current, ribbon: event.target.value as BouquetDesign['ribbon'] }))}>{ribbons.map(ribbon => <option key={ribbon}>{ribbon}</option>)}</select>
        <label className="check"><input type="checkbox" checked={design.messageCard} onChange={event => setDesign(current => ({ ...current, messageCard: event.target.checked }))} /> Add a message card</label>
        <div className="pricing-pending"><span>Estimated total</span><strong>Pricing coming soon</strong><small>Component prices are pending approval.</small></div>
        <button className="button primary wide" disabled>Add to Cart — Coming Soon</button>
      </aside>
        <section className="draft-panel" aria-labelledby="draft-heading">
          <p className="eyebrow">KEEP YOUR FLOWERS CLOSE</p>
          <h2 id="draft-heading">Your preview draft</h2>
          <p id="draft-help">Save one draft on this browser and device. Saving replaces the previous draft. It is shared by people using this browser, is not an account-backed saved design, and may be lost if browser data is cleared.</p>
          {savedAt && <p className="draft-saved">Last saved: <time dateTime={savedAt}>{new Date(savedAt).toLocaleString()}</time></p>}
          <div className="draft-actions" aria-describedby="draft-help">
            <button className="button primary" onClick={save}><Save size={16} /> Save preview draft</button>
            <button className="button outline" onClick={reopen}><FolderOpen size={16} /> Reopen saved draft</button>
            <button className="button outline" onClick={reset}><RotateCcw size={16} /> Reset bouquet</button>
            <button className="draft-remove" onClick={discard}><Trash2 size={15} /> Remove saved draft</button>
          </div>
          <p className="draft-status" role="status" aria-live="polite" aria-atomic="true">{notice}</p>
          {(error || !stored.ok) && <p className="feedback error" role="alert">{error || (!stored.ok ? stored.error : '')}</p>}
        </section>
        <section className="design-summary" aria-labelledby="summary-heading">
          <h2 id="summary-heading">Your bouquet at a glance</h2>
          <p><strong>{total} / {MAX_STEMS} stems</strong> • Preview colors only; inventory availability will be verified before ordering.</p>
          {design.flowers.length ? <ul>{design.flowers.map(flower => <li key={`${flower.kind}-${flower.color}`}>
            <span className="summary-swatch" style={{ background: flower.color }} aria-hidden="true" />
            <span>{flower.count} × {colorName(flower.kind, flower.color)} {flower.kind}</span>
            <button onClick={() => setDesign(current => changeStem(current, flower.kind, flower.color, -1))} aria-label={`Remove one ${colorName(flower.kind, flower.color)} ${flower.kind}`}><Minus size={15} /></button>
          </li>)}</ul> : <p>No stems yet. Choose a flower and add a stem to begin.</p>}
          <dl><div><dt>Wrapper</dt><dd>{design.wrapper}</dd></div><div><dt>Ribbon</dt><dd>{design.ribbon}</dd></div><div><dt>Message card</dt><dd>{design.messageCard ? 'Included' : 'Not selected'}</dd></div></dl>
        </section>
        <AccountDesigns design={design} onOpen={setDesign} />
    </div>
  </main>;
}
