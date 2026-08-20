import { AlertCircle, ArrowLeft, Home } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <main className="not-found-page">
      <section className="not-found-panel" aria-labelledby="not-found-title">
        <div className="not-found-mark"><AlertCircle size={28} aria-hidden="true" /></div>
        <span className="not-found-kicker">ZTerminal route recovery</span>
        <h1 id="not-found-title">This workspace path is unavailable.</h1>
        <p>The requested page does not exist in the current research workstation. Return to the landing page or continue to the public terminal.</p>
        <div className="not-found-actions">
          <button className="not-found-primary" onClick={() => setLocation("/")} type="button"><Home size={15} /> Return home</button>
          <Link className="not-found-secondary" href="/terminal"><ArrowLeft size={15} /> Open terminal</Link>
        </div>
        <small>Public-market research only · execution remains disabled</small>
      </section>
    </main>
  );
}
