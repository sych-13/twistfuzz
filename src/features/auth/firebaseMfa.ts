import { getMultiFactorResolver, PhoneAuthProvider, PhoneMultiFactorGenerator, RecaptchaVerifier, signOut, TotpMultiFactorGenerator } from 'firebase/auth';
import type { Auth, MultiFactorError, MultiFactorResolver, PhoneMultiFactorInfo, User } from 'firebase/auth';
import { AuthFlowError, verificationCode } from './authFlow';
import type { FactorChoice } from './authFlow';

export type MfaSession = {
  factors: FactorChoice[];
  sendSms: (uid: string, container: HTMLElement) => Promise<void>;
  complete: (uid: string, code: string) => Promise<User>;
  clear: () => void;
};

export function isMultiFactorError(error: unknown): error is MultiFactorError {
  return !!error && typeof error === 'object' && 'code' in error && error.code === 'auth/multi-factor-auth-required';
}

export function firebaseMfaSession(auth: Auth, error: MultiFactorError): MfaSession {
  return sessionFromResolver(auth, getMultiFactorResolver(auth, error));
}

function sessionFromResolver(auth: Auth, resolver: MultiFactorResolver): MfaSession {
  let verifier: RecaptchaVerifier | null = null;
  let cleared = false;
  let smsGeneration = 0;
  const verificationIds = new Map<string, string>();
  const factors: FactorChoice[] = resolver.hints.flatMap((hint, index): FactorChoice[] => {
    if (hint.factorId === TotpMultiFactorGenerator.FACTOR_ID) return [{ uid: hint.uid, kind: 'totp', label: hint.displayName || `Authenticator app ${index + 1}` }];
    if (hint.factorId === PhoneMultiFactorGenerator.FACTOR_ID) {
      const suffix = (hint as PhoneMultiFactorInfo).phoneNumber.replace(/\D/g, '').slice(-4);
      return [{ uid: hint.uid, kind: 'phone', label: suffix ? `Text message ending ${suffix}` : `Enrolled phone ${index + 1}` }];
    }
    return [];
  });
  if (!factors.length) throw new AuthFlowError('unsupported-factor', 'This account has no supported verification method. Use your established account recovery process.');
  const ensureOpen = () => { if (cleared) throw new AuthFlowError('cancelled', 'This sign-in was cancelled. Start again to continue.'); };
  return {
    factors,
    async sendSms(uid, container) {
      ensureOpen();
      const hint = resolver.hints.find(factor => factor.uid === uid && factor.factorId === PhoneMultiFactorGenerator.FACTOR_ID);
      if (!hint) throw new AuthFlowError('invalid-factor', 'Choose an enrolled phone verification method.');
      const generation = ++smsGeneration;
      verificationIds.delete(uid);
      verifier?.clear();
      const currentVerifier = new RecaptchaVerifier(auth, container, { size: 'normal' });
      verifier = currentVerifier;
      try {
        const id = await new PhoneAuthProvider(auth).verifyPhoneNumber({ multiFactorHint: hint as PhoneMultiFactorInfo, session: resolver.session }, currentVerifier);
        ensureOpen();
        if (generation !== smsGeneration) throw new AuthFlowError('cancelled', 'The verification method changed. Request a new code.');
        verificationIds.set(uid, id);
      } finally {
        if (verifier === currentVerifier) { verifier = null; currentVerifier.clear(); }
      }
    },
    async complete(uid, input) {
      ensureOpen();
      const code = verificationCode(input);
      const factor = factors.find(item => item.uid === uid);
      if (!factor) throw new AuthFlowError('invalid-factor', 'Choose one of your enrolled verification methods.');
      let assertion;
      if (factor.kind === 'totp') assertion = TotpMultiFactorGenerator.assertionForSignIn(uid, code);
      else {
        const id = verificationIds.get(uid);
        if (!id) throw new AuthFlowError('sms-required', 'Request a verification code for this phone first.');
        assertion = PhoneMultiFactorGenerator.assertion(PhoneAuthProvider.credential(id, code));
      }
      const result = await resolver.resolveSignIn(assertion);
      if (cleared && auth.currentUser === result.user) await signOut(auth);
      ensureOpen();
      return result.user;
    },
    clear() { cleared = true; smsGeneration++; verificationIds.clear(); verifier?.clear(); verifier = null; },
  };
}
