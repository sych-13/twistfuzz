import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { AccountDesignLibrary } from '../src/features/studio/AccountDesignLibrary';
import { defaultDesign } from '../src/features/studio/design';
import { DesignServiceError } from '../src/features/studio/savedDesigns';
import type { DesignCommand, DesignResult, SavedDesign } from '../src/features/studio/savedDesigns';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://127.0.0.1/' });
for (const [name, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, MutationObserver: dom.window.MutationObserver })) Object.defineProperty(globalThis, name, { value, configurable: true });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const { render, fireEvent, cleanup, waitFor } = await import('@testing-library/react');
afterEach(cleanup);
const row: SavedDesign = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Garden', configuration: defaultDesign(), revision: 7, created_at: '2026-10-17T00:00:00Z', updated_at: '2026-10-17T00:00:00Z' };
const props = () => ({ design: defaultDesign(), onOpen: (_design: ReturnType<typeof defaultDesign>) => {} });
function transport(calls: DesignCommand[], other?: (command: DesignCommand) => Promise<DesignResult>) {
  return async (command: DesignCommand): Promise<DesignResult> => {
    calls.push(command);
    if (command.action === 'list') return { designs: [row], hasMore: false };
    if (other) return other(command);
    return command.action === 'delete' ? { deleted: true } : { design: row };
  };
}
test('opening requires confirmation and updates carry the opened server revision', async () => {
  const calls: DesignCommand[] = []; const opened: unknown[] = [];
  const ui = render(<AccountDesignLibrary {...props()} onOpen={design => opened.push(design)} request={transport(calls)} />);
  await waitFor(() => assert.ok(ui.getByRole('button', { name: 'Open Garden' })));
  fireEvent.click(ui.getByRole('button', { name: 'Open Garden' })); assert.equal(opened.length, 0);
  fireEvent.click(ui.getByRole('button', { name: 'Replace bouquet' }));
  await waitFor(() => assert.equal(opened.length, 1));
  fireEvent.click(ui.getByRole('button', { name: 'Update opened account design' }));
  await waitFor(() => assert.ok(calls.some(command => command.action === 'update' && command.revision === 7 && command.id === row.id)));
});
test('delete can be cancelled and requires the listed revision without changing the current bouquet', async () => {
  const calls: DesignCommand[] = []; let opened = 0;
  const ui = render(<AccountDesignLibrary {...props()} onOpen={() => opened++} request={transport(calls)} />);
  await waitFor(() => assert.ok(ui.getByRole('button', { name: 'Delete Garden' })));
  fireEvent.click(ui.getByRole('button', { name: 'Delete Garden' })); fireEvent.click(ui.getByRole('button', { name: 'Cancel' }));
  assert.equal(calls.filter(command => command.action === 'delete').length, 0);
  fireEvent.click(ui.getByRole('button', { name: 'Delete Garden' })); fireEvent.click(ui.getByRole('button', { name: 'Confirm delete' }));
  await waitFor(() => assert.ok(!ui.queryByRole('button', { name: 'Delete Garden' })));
  assert.ok(calls.some(command => command.action === 'delete' && command.revision === 7)); assert.equal(opened, 0);
});
test('conflicts retain the current bouquet and never silently retry an update', async () => {
  const calls: DesignCommand[] = [];
  const ui = render(<AccountDesignLibrary {...props()} request={transport(calls, async command => {
    if (command.action === 'update') throw new DesignServiceError(409); return { design: row };
  })} />);
  await waitFor(() => assert.ok(ui.getByRole('button', { name: 'Open Garden' })));
  fireEvent.click(ui.getByRole('button', { name: 'Open Garden' })); fireEvent.click(ui.getByRole('button', { name: 'Replace bouquet' }));
  await waitFor(() => assert.ok(!ui.queryByRole('button', { name: 'Replace bouquet' })));
  fireEvent.click(ui.getByRole('button', { name: 'Update opened account design' }));
  await waitFor(() => assert.match(ui.getByRole('alert').textContent!, /Refresh/));
  assert.equal(calls.filter(command => command.action === 'update').length, 1);
});
test('a late open cannot replace a bouquet edited while the request was pending', async () => {
  let finish!: (result: DesignResult) => void; let opened = 0;
  const calls: DesignCommand[] = []; const request = transport(calls, () => new Promise(resolve => { finish = resolve; }));
  const original = props(); const onOpen = () => opened++;
  const ui = render(<AccountDesignLibrary {...original} onOpen={onOpen} request={request} />);
  await waitFor(() => assert.ok(ui.getByRole('button', { name: 'Open Garden' })));
  fireEvent.click(ui.getByRole('button', { name: 'Open Garden' })); fireEvent.click(ui.getByRole('button', { name: 'Replace bouquet' }));
  ui.rerender(<AccountDesignLibrary {...original} design={{ ...original.design, ribbon: 'No Ribbon' }} onOpen={onOpen} request={request} />);
  await act(async () => finish({ design: row }));
  assert.equal(opened, 0); assert.match(ui.getByRole('alert').textContent!, /bouquet changed/);
});
test('unmounting invalidates late account results and double clicks issue one mutation', async () => {
  let finish!: (result: DesignResult) => void; let opened = 0; const calls: DesignCommand[] = [];
  const ui = render(<AccountDesignLibrary {...props()} onOpen={() => opened++} request={transport(calls, () => new Promise(resolve => { finish = resolve; }))} />);
  await waitFor(() => assert.ok(ui.getByRole('button', { name: 'Open Garden' })));
  fireEvent.click(ui.getByRole('button', { name: 'Open Garden' })); fireEvent.click(ui.getByRole('button', { name: 'Replace bouquet' }));
  ui.unmount(); await act(async () => finish({ design: row })); assert.equal(opened, 0);
  const saves: DesignCommand[] = [];
  const next = render(<AccountDesignLibrary {...props()} request={transport(saves, () => new Promise(resolve => { finish = resolve; }))} />);
  await waitFor(() => assert.ok(next.getByRole('button', { name: 'Open Garden' })));
  const button = next.getByRole('button', { name: 'Save as new account design' });
  act(() => { fireEvent.click(button); fireEvent.click(button); });
  assert.equal(saves.filter(command => command.action === 'create').length, 1);
  await act(async () => finish({ design: row }));
});
test('lost Customer permission clears private list data and opened selection', async () => {
  const calls: DesignCommand[] = [];
  const ui = render(<AccountDesignLibrary {...props()} request={transport(calls, async () => { throw new DesignServiceError(403); })} />);
  await waitFor(() => assert.ok(ui.getByRole('button', { name: 'Open Garden' })));
  fireEvent.click(ui.getByRole('button', { name: 'Save as new account design' }));
  await waitFor(() => assert.match(ui.getByRole('alert').textContent!, /Customer access/));
  assert.ok(!ui.queryByRole('button', { name: 'Open Garden' }));
});
