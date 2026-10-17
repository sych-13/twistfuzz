import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import MfaChallenge from '../src/features/auth/MfaChallenge';

const root = new URL('../', import.meta.url);
const version = JSON.parse(readFileSync(new URL('package.json', root), 'utf8')).version;
const cssFile = readdirSync(new URL('dist/assets/', root)).find(file => file.endsWith('.css'));
if (!cssFile) throw new Error('Build before capturing MFA visual evidence.');
const css = readFileSync(new URL(`dist/assets/${cssFile}`, root), 'utf8');
// This is static QA markup outside public/ and dist/. No credentials, working
// sign-in handler, test route or runtime authentication bypass is introduced.
const content = renderToStaticMarkup(<main className="auth-form"><div className="auth-card"><span className="pill">ADMIN PORTAL</span><MfaChallenge
  portal="admin" factors={[{ uid: 'qa-totp', kind: 'totp', label: 'Authenticator app' }, { uid: 'qa-phone', kind: 'phone', label: 'Text message ending 1234' }]}
  busy={false} error="" onVerify={async () => {}} onSendSms={async () => false} onCancel={() => {}}
/></div></main>);
writeFileSync(new URL(`docs/qa/v${version}-mfa-static.html`, root), `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MFA visual QA fixture</title><style>${css}</style></head><body>${content}</body></html>`);
console.log(`Static MFA QA markup generated for v${version}; not included in the application build.`);
