import type { Metadata } from "next";
import Link from "next/link";

import { publicWindowsRelease } from "@/lib/releases/windows-release";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Installing ZTerminal on Windows",
  description: "Official ZTerminal Windows installation, update, and release-security guidance.",
};

export default function WindowsInstallationGuide() {
  const release = publicWindowsRelease();

  return (
    <main className="min-h-screen bg-[#060914] px-5 py-12 text-slate-100 sm:px-10 lg:px-20">
      <div className="mx-auto max-w-4xl">
        <Link href="/download" className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300 hover:text-cyan-100">← Windows release status</Link>
        <p className="mt-12 text-xs font-semibold tracking-[0.18em] text-violet-300">ZTERMINAL FOR WINDOWS</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">Installing ZTerminal on Windows</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-400">This page is the official reference for the ZTerminal Windows release path. It distinguishes verified public releases from the native desktop work that is still in development.</p>

        <section className="mt-12 rounded-2xl border border-slate-700/70 bg-slate-900/50 p-7">
          <p className="text-xs font-semibold tracking-[0.16em] text-violet-300">CURRENT RELEASE STATUS</p>
          {release.available ? (
            <>
              <h2 className="mt-3 text-2xl font-semibold">ZTerminal {release.version} is available for Windows x64.</h2>
              <p className="mt-3 leading-7 text-slate-400">The official package is signed, versioned, and distributed through the verified ZTerminal release route. Check the publisher and SHA-256 before installation if your organization requires independent verification.</p>
              <Link href="/download" className="mt-5 inline-flex rounded-md bg-violet-200 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-white">Download ZTerminal</Link>
            </>
          ) : (
            <>
              <h2 className="mt-3 text-2xl font-semibold">No signed public Windows installer is available yet.</h2>
              <p className="mt-3 leading-7 text-slate-400">ZTerminal will not ask you to download a development artifact. Windows compatibility, verified signing, measured requirements, release notes, and update details will be published here before the first public installer is enabled.</p>
              <p className="mt-4 font-mono text-xs tracking-wide text-amber-200">STATUS: {release.reason.replaceAll("_", " ")}</p>
            </>
          )}
        </section>

        <section className="mt-12 grid gap-6 sm:grid-cols-2">
          <article className="rounded-xl border border-slate-800 bg-slate-950/50 p-6"><h2 className="text-xl font-semibold">When a release is available</h2><ol className="mt-4 list-decimal space-y-3 pl-5 leading-7 text-slate-400"><li>Download only from the official ZTerminal download page.</li><li>Confirm the displayed product and publisher before installation.</li><li>Run the signed MSIX installer and complete the normal Windows installation flow.</li><li>Launch ZTerminal and use the same ZTerminal account when account features are enabled.</li></ol></article>
          <article className="rounded-xl border border-slate-800 bg-slate-950/50 p-6"><h2 className="text-xl font-semibold">Updates and recovery</h2><p className="mt-4 leading-7 text-slate-400">Supported released builds will receive version information from the same release source used by this website. If an update or release is paused, the website and the application will both stop advertising that release. User workspaces and cached data must be preserved through verified upgrades; uninstall guidance will clearly distinguish program files from user data.</p></article>
        </section>

        <section className="mt-12 border-t border-slate-800 pt-9"><h2 className="text-2xl font-semibold">Need ZTerminal now?</h2><p className="mt-3 max-w-2xl leading-7 text-slate-400">The browser research terminal remains the available ZTerminal workspace while the Windows release completes native host, package, signing, and acceptance validation.</p><Link href="/terminal" className="mt-5 inline-flex rounded-md border border-cyan-300/60 px-4 py-2 text-sm font-semibold text-cyan-200 hover:border-cyan-100 hover:text-cyan-50">Open web terminal</Link></section>
      </div>
    </main>
  );
}
