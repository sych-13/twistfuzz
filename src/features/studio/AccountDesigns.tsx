import type { User } from 'firebase/auth';
import { Link } from 'react-router-dom';
import { useSession } from '../../hooks/useSession';
import { authIntegrationReady } from '../../services/firebase';
import { requestSavedDesigns } from '../../services/designs';
import { AccountDesignLibrary } from './AccountDesignLibrary';
import type { AccountDesignProps } from './AccountDesignLibrary';

function CustomerLibrary({ user, ...props }: AccountDesignProps & { user: User }) {
  return <AccountDesignLibrary {...props} request={command => requestSavedDesigns(user, command)} />;
}
export default function AccountDesigns(props: AccountDesignProps) {
  const { user, loading } = useSession();
  return <section id="account-designs" className="draft-panel account-design-panel" aria-labelledby="account-design-heading">
    <p className="eyebrow">YOUR CUSTOMER COLLECTION</p><h2 id="account-design-heading">Saved to your account</h2>
    <p>Account designs are separate from your browser-local preview draft. They do not reserve stock or place an order.</p>
    {!authIntegrationReady ? <p className="notice">Account saving is pending authentication setup and security validation. You can keep using the preview draft above.</p> :
      loading ? <p role="status">Checking your Customer session…</p> : !user || !user.emailVerified ? <Link className="button outline" to="/login">Sign in to your verified Customer account</Link> :
        <CustomerLibrary key={user.uid} user={user} {...props} />}
  </section>;
}
