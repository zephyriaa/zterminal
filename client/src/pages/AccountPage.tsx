import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CloudOff, LogIn, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { Link } from "wouter";

function AccountLoading() {
  return <main className="account-page"><div className="account-shell account-loading"><span className="account-kicker">ZTerminal account</span><h1>Checking your session…</h1><p>Identity controls are loading without interrupting access to public market research.</p></div></main>;
}

export default function AccountPage() {
  const { user, loading, logout } = useAuth();
  const draftsQuery = trpc.research.listDrafts.useQuery(undefined, { enabled: Boolean(user), retry: false });

  if (loading) return <AccountLoading />;

  if (!user) {
    return <main className="account-page"><section className="account-shell account-guest"><div className="account-icon"><UserRound size={24} /></div><span className="account-kicker">Your ZTerminal account</span><h1>Keep your research connected to you.</h1><p>Sign in to associate research drafts and future Indicator Lab definitions with your identity. Public market charts stay available without an account.</p><div className="account-actions"><button className="account-primary" onClick={() => startLogin()}><LogIn size={16} /> Sign in</button><Link href="/terminal" className="account-secondary">Continue as guest</Link></div><small><ShieldCheck size={14} /> OAuth-backed identity · no password collection · no trading credentials</small></section></main>;
  }

  const storageUnavailable = draftsQuery.isError;
  const draftCount = draftsQuery.data?.length ?? 0;
  return <main className="account-page"><section className="account-shell account-member"><div className="account-member-header"><div className="account-avatar">{(user.name || user.email || "Z").slice(0, 1).toUpperCase()}</div><div><span className="account-kicker">Signed in to ZTerminal</span><h1>{user.name || "Research account"}</h1><p>{user.email || "Identity verified through your connected account"}</p></div><button className="account-logout" onClick={() => logout()}><LogOut size={15} /> Sign out</button></div>
    <div className="account-overview-grid"><article><span>Research drafts</span><b>{storageUnavailable ? "—" : draftCount}</b><small>{storageUnavailable ? "Cloud storage not configured" : "Owned by your account"}</small></article><article><span>Indicator Lab</span><b>Local</b><small>Cloud library pending storage setup</small></article><article><span>Execution</span><b>Disabled</b><small>No broker or order route</small></article></div>
    <section className={`account-storage ${storageUnavailable ? "unavailable" : "available"}`}><div><CloudOff size={18} /><div><b>{storageUnavailable ? "Cloud workspace unavailable" : "Cloud workspace available"}</b><p>{storageUnavailable ? "This deployment has no configured durable workspace storage. Your identity is active; save any active draft locally until the service owner provisions database and OAuth environment configuration." : "Your research drafts are associated with your signed-in account."}</p></div></div>{storageUnavailable ? <Link href="/terminal" className="account-secondary">Return to local-first terminal</Link> : <Link href="/terminal" className="account-secondary">Open terminal</Link>}</section>
    <div className="account-footer"><Link href="/"> <ArrowLeft size={15} /> Back to home</Link><Link href="/terminal">Open research terminal</Link></div>
  </section></main>;
}
