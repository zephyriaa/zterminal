"use client";
import { signIn } from "next-auth/react";
export function NativeSignIn({ callbackUrl }: { callbackUrl: string }) {
  return <main className="mx-auto max-w-lg p-8"><h1 className="mb-4 text-2xl">Connect ZTerminal for Windows</h1><p className="mb-6">Sign in with your existing ZTerminal account, then approve this Windows device. Local work stays on your computer.</p><button className="rounded-lg bg-violet-300 px-5 py-3 text-black focus-visible:outline-2 focus-visible:outline-offset-4" onClick={() => void signIn("google", { callbackUrl })}>Continue with ZTerminal</button><p className="mt-6">You can close this page and continue offline in the Windows app.</p></main>;
}
