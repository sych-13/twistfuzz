import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, reload, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { auth, authIntegrationReady, googleProvider } from '../../services/firebase';
import { resolveRole } from '../../services/roles';
import { ensureCustomerAccount } from '../../services/customer';
import type { Role } from '../../services/roles';
import { authenticationMessage, AuthFlowError, operationGuard, verifyPortalAccount } from './authFlow';
import { firebaseMfaSession, isMultiFactorError } from './firebaseMfa';
import type { MfaSession } from './firebaseMfa';
import MfaChallenge from './MfaChallenge';

const titles = { customer: 'Welcome back to the garden.', staff: 'Staff Portal', admin: 'Admin Portal' };

export default function AuthPage({ mode }: { mode: Role }) {
  const navigate = useNavigate();
  const [variant, setVariant] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [challenge, setChallenge] = useState<MfaSession | null>(null);
  const pending = useRef<MfaSession | null>(null);
  const operations = useRef(operationGuard());
  useEffect(() => () => { operations.current.invalidate(); pending.current?.clear(); pending.current = null; }, []);

  const discardChallenge = () => { pending.current?.clear(); pending.current = null; setChallenge(null); };
  const abandonLateResult = async (user: User) => { if (auth?.currentUser === user) await signOut(auth); };
  const finish = async (user: User, active: () => boolean) => {
    if (!active()) { await abandonLateResult(user); return; }
    discardChallenge(); setPassword('');
    await verifyPortalAccount(user, mode, {
      refresh: async account => { await reload(account); await account.getIdToken(true); },
      resolveRole, ensureCustomer: ensureCustomerAccount, isActive: active, signOutCurrent: async () => abandonLateResult(user),
    });
    if (active() && auth?.currentUser?.uid === user.uid) navigate(mode === 'customer' ? '/account' : `/${mode}/dashboard`, { replace: true });
    else await abandonLateResult(user);
  };

  const run = async (work: (active: () => boolean) => Promise<void>) => {
    if (!authIntegrationReady || !auth || busy) return;
    const active = operations.current.begin();
    setBusy(true); setError(''); setInfo('');
    try { await work(active); }
    catch (cause) {
      if (!active()) return;
      if (isMultiFactorError(cause)) {
        try {
          const session = firebaseMfaSession(auth, cause);
          pending.current?.clear(); pending.current = session; setChallenge(session); setPassword('');
        } catch (failure) { setError(authenticationMessage(failure)); }
      } else setError(authenticationMessage(cause));
    } finally { if (active()) setBusy(false); }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const enteredPassword = password;
    void run(async active => {
      if (!auth) return;
      if (mode !== 'customer' && variant !== 'login') throw new AuthFlowError('restricted-action', 'Use your established account recovery process.');
      if (variant === 'reset') {
        await sendPasswordResetEmail(auth, email);
        if (active()) setInfo('If the account is eligible, a recovery email will be sent.');
      } else if (variant === 'register') {
        const result = await createUserWithEmailAndPassword(auth, email, enteredPassword);
        try { await sendEmailVerification(result.user); }
        finally { await abandonLateResult(result.user); }
        if (active()) { setPassword(''); setVariant('login'); setInfo('Check your inbox to verify your email, then sign in. Account access must be authorized before using a portal.'); }
      } else {
        const result = await signInWithEmailAndPassword(auth, email, enteredPassword);
        await finish(result.user, active);
      }
    });
  };

  const google = () => { void run(async active => {
    if (!auth || mode !== 'customer') return;
    const result = await signInWithPopup(auth, googleProvider);
    await finish(result.user, active);
  }); };

  const confirmMfa = async (uid: string, code: string) => {
    const session = pending.current;
    if (!session) return;
    await run(async active => { const user = await session.complete(uid, code); await finish(user, active); });
  };
  const sendSms = async (uid: string, container: HTMLElement): Promise<boolean> => {
    const session = pending.current;
    if (!session || busy || !authIntegrationReady) return false;
    const active = operations.current.begin();
    setBusy(true); setError('');
    try { await session.sendSms(uid, container); return active(); }
    catch (cause) { if (active()) setError(authenticationMessage(cause)); return false; }
    finally { if (active()) setBusy(false); }
  };
  const cancelMfa = () => {
    operations.current.invalidate(); discardChallenge(); setPassword(''); setBusy(false); setError(''); setInfo('Sign-in cancelled. Enter your details to start again.');
  };
  const changeVariant = (value: typeof variant) => {
    if (busy) return;
    operations.current.invalidate(); discardChallenge(); setVariant(value); setPassword(''); setError(''); setInfo('');
  };

  return <main className="auth-layout">
    <section className="auth-side">
      <img src="/branding/twistfuzz-logo.jpg" alt="TWISTFUZZ logo" />
      <p className="eyebrow">TWISTFUZZ BLOOM STUDIO</p>
      <h2>{mode === 'customer' ? 'Every bloom begins with a little love.' : mode === 'staff' ? 'Make every order bloom beautifully.' : 'A thoughtful space for your business.'}</h2>
      <span>Elegant Garden • Secure {mode} portal</span>
    </section>
    <section className="auth-form"><div className="auth-card">
      <Link className="auth-back" to="/">← Back to TWISTFUZZ</Link>
      <span className="pill">{mode.toUpperCase()} PORTAL</span>
      {challenge ? <MfaChallenge portal={mode} factors={challenge.factors} busy={busy} error={error} onVerify={confirmMfa} onSendSms={sendSms} onCancel={cancelMfa} /> : <>
        <h1>{variant === 'reset' ? 'Reset your password' : variant === 'register' ? 'Create your account' : titles[mode]}</h1>
        <p>{mode === 'customer' ? 'Sign in to explore your saved designs and orders.' : 'Authorized accounts only. Your access will be verified.'}</p>
        {!authIntegrationReady && <div className="notice">Authentication setup pending — this preview does not accept real logins.</div>}
        <form onSubmit={submit} aria-busy={busy}>
          <label htmlFor="portal-email">Email address</label>
          <div className="field"><Mail size={18} /><input id="portal-email" disabled={!authIntegrationReady || busy} type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></div>
          {variant !== 'reset' && <><label htmlFor="portal-password">Password</label><div className="field"><LockKeyhole size={18} />
            <input id="portal-password" disabled={!authIntegrationReady || busy} type={show ? 'text' : 'password'} minLength={6} required autoComplete={variant === 'register' ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your password" />
            <button type="button" disabled={busy} onClick={() => setShow(!show)} aria-label="Toggle password visibility" aria-pressed={show}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>
          </div></>}
          {error && <p className="feedback error" role="alert">{error}</p>}
          {info && <p className="feedback success" role="status">{info}</p>}
          <button className="button primary wide" type="submit" disabled={!authIntegrationReady || busy}>{busy ? 'Please wait…' : variant === 'login' ? 'Sign In' : variant === 'register' ? 'Register' : 'Send reset link'} <ArrowRight size={17} /></button>
        </form>
        {mode === 'customer' && variant === 'login' && <><div className="or">or</div><button className="google-button" disabled={!authIntegrationReady || busy} onClick={google}>G &nbsp; Continue with Google</button></>}
        {mode === 'customer' ? <div className="auth-actions">
          {variant !== 'reset' && <button disabled={busy} onClick={() => changeVariant(variant === 'register' ? 'login' : 'register')}>{variant === 'register' ? 'Already registered? Sign in' : 'New here? Create an account'}</button>}
          <button disabled={busy} onClick={() => changeVariant(variant === 'reset' ? 'login' : 'reset')}>{variant === 'reset' ? 'Return to sign in' : 'Forgot password?'}</button>
        </div> : <div className="auth-actions"><span>{mode === 'admin' ? 'Owner accounts require MFA. Use your pre-established owner recovery process if access is lost.' : 'Accounts and recovery are managed by your administrator.'}</span></div>}
      </>}
      <div className="auth-links"><Link to="/login">Customer</Link><Link to="/staff/login">Staff</Link><Link to="/admin/login">Admin</Link></div>
    </div></section>
  </main>;
}
