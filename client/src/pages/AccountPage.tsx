import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { ArrowLeft, CloudOff, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { Link } from "wouter";

function AccountLoading() {
  return <main className="account-page"><div className="account-shell account-loading"><span className="account-kicker">ZTerminal account</span><h1>Checking your session…</h1><p>Identity controls are loading without interrupting access to public market research.</p></div></main>;
}

export default function AccountPage() {
  const { user, loading, logout } = useAuth();
  const draftsQuery = trpc.research.listDrafts.useQuery(undefined, { enabled: Boolean(user), retry: false });

  if (loading) return <AccountLoading />;

  if (!user) {
    return <main className="account-page"><section className="account-shell account-guest"><div className="account-icon"><UserRound size={24} /></div><span className="account-kicker">Account access</span><h1>Research ownership, configured deliberately.</h1><p>Public charts and research remain available to guests. Google sign-in becomes available only after this deployment has verified identity, session, and durable-storage configuration.</p><div className="account-actions"><GoogleSignInButton className="account-google-sign-in" unavailableLabel="Google sign-in requires deployment configuration" /><Link href="/terminal" className="account-secondary">Continue as guest</Link></div><small><ShieldCheck size={14} /> Google subject-based identity · no password collection · no trading credentials</small></section></main>;
  }

  const storageUnavailable = draftsQuery.isError;
  const draftCount = draftsQuery.data?.length ?? 0;
  return <main className="account-page"><section className="account-shell account-member"><div className="account-member-header"><div className="account-avatar">{(user.name || user.email || "Z").slice(0, 1).toUpperCase()}</div><div><span className="account-kicker">Signed in to ZTerminal</span><h1>{user.name || "Research account"}</h1><p>{user.email || "Identity verified through the configured account provider"}</p></div><button className="account-logout" onClick={() => logout()}><LogOut size={15} /> Sign out</button></div>
    <div className="account-overview-grid"><article><span>Research drafts</span><b>{storageUnavailable ? "—" : draftCount}</b><small>{storageUnavailable ? "Cloud storage not configured" : "Owned by your account"}</small></article><article><span>Indicator Lab</span><b>Local</b><small>Cloud library requires verified storage</small></article><article><span>Execution</span><b>Disabled</b><small>No broker or order route</small></article></div>
    <section className={`account-storage ${storageUnavailable ? "unavailable" : "available"}`}><div><CloudOff size={18} /><div><b>{storageUnavailable ? "Cloud workspace unavailable" : "Cloud workspace available"}</b><p>{storageUnavailable ? "Durable research storage is not configured for this deployment. Keep active work locally until the service owner enables and verifies the identity and database environment." : "Your research drafts are associated with your signed-in account."}</p></div></div>{storageUnavailable ? <Link href="/terminal" className="account-secondary">Return to local-first terminal</Link> : <Link href="/terminal" className="account-secondary">Open terminal</Link>}</section>
    <div className="account-footer"><Link href="/"> <ArrowLeft size={15} /> Back to home</Link><Link href="/terminal">Open research terminal</Link></div>
  </section></main>;
}
