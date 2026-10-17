import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { FactorChoice, PortalRole } from './authFlow';
import { operationGuard } from './authFlow';

type Props = {
  portal: PortalRole; factors: FactorChoice[]; busy: boolean; error: string;
  onVerify: (uid: string, code: string) => Promise<void>;
  onSendSms: (uid: string, container: HTMLElement) => Promise<boolean>;
  onCancel: () => void;
};

export default function MfaChallenge({ portal, factors, busy, error, onVerify, onSendSms, onCancel }: Props) {
  const [uid, setUid] = useState(() => factors.find(factor => factor.kind === 'totp')?.uid ?? factors[0]?.uid ?? '');
  const [code, setCode] = useState('');
  const [smsSent, setSmsSent] = useState(false);
  const [localError, setLocalError] = useState('');
  const container = useRef<HTMLDivElement>(null);
  const guard = useRef(operationGuard());
  useEffect(() => () => guard.current.invalidate(), []);
  const factor = factors.find(choice => choice.uid === uid);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!factor || !/^\d{6}$/.test(code)) { setLocalError('Enter the six-digit verification code.'); return; }
    if (factor.kind === 'phone' && !smsSent) { setLocalError('Request a verification code first.'); return; }
    const entered = code;
    setCode(''); setLocalError('');
    await onVerify(uid, entered);
  };
  const send = async () => {
    if (busy || !container.current || !factor) return;
    const active = guard.current.begin();
    setLocalError(''); setSmsSent(false); setCode('');
    const sent = await onSendSms(uid, container.current);
    if (active()) setSmsSent(sent);
  };
  return <section className="mfa-challenge" aria-labelledby="mfa-heading">
    <ShieldCheck className="mfa-icon" size={30} />
    <h1 id="mfa-heading">Verify your sign-in</h1>
    <p>{portal === 'admin' ? 'Admin access requires a second verification step.' : 'Complete your enrolled verification step to continue.'}</p>
    {factors.length > 1 ? <><label htmlFor="mfa-method">Verification method</label><select id="mfa-method" value={uid} disabled={busy} onChange={event => {
      guard.current.invalidate(); setUid(event.target.value); setCode(''); setSmsSent(false); setLocalError('');
    }}>{factors.map(choice => <option key={choice.uid} value={choice.uid}>{choice.label}</option>)}</select></> : <p className="mfa-method">{factor?.label ?? 'No supported method available'}</p>}
    {factor?.kind === 'phone' && <div className="mfa-sms">
      <p>Send a code to your enrolled phone, then enter it below.</p>
      <div ref={container} className="mfa-recaptcha" />
      <button className="button outline wide" type="button" disabled={busy} onClick={send}>{busy ? 'Please wait…' : smsSent ? 'Send a new code' : 'Send verification code'}</button>
      {smsSent && <p className="feedback success" role="status">Verification code sent to your enrolled phone.</p>}
    </div>}
    {factor?.kind === 'totp' && <p>Enter the current code from your authenticator app.</p>}
    <form onSubmit={submit} aria-busy={busy} noValidate>
      <label htmlFor="mfa-code">Verification code</label>
      <div className="field"><input id="mfa-code" autoFocus inputMode="numeric" autoComplete="one-time-code" type="text" pattern="[0-9]{6}" maxLength={6} required
        disabled={busy || !factor || (factor.kind === 'phone' && !smsSent)} value={code}
        aria-describedby={(localError || error) ? 'mfa-error' : undefined} aria-invalid={!!(localError || error)}
        onChange={event => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setLocalError(''); }} /></div>
      {(localError || error) && <p id="mfa-error" className="feedback error" role="alert">{localError || error}</p>}
      <button className="button primary wide" type="submit" disabled={busy || !factor || (factor.kind === 'phone' && !smsSent)}>{busy ? 'Verifying…' : 'Verify and continue'}</button>
    </form>
    <button className="mfa-cancel" type="button" onClick={() => { guard.current.invalidate(); setCode(''); onCancel(); }}>Cancel sign-in</button>
    <p className="mfa-recovery">{portal === 'admin' ? 'Lost your verification method? Use your pre-established owner recovery process. Password reset alone does not restore Admin access.' : portal === 'staff' ? 'Lost your verification method? Contact your administrator for account recovery.' : 'If your verification method is unavailable, contact TWISTFUZZ for account recovery.'}</p>
  </section>;
}
