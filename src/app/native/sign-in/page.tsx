import { nativeAuthorization } from "@/lib/native-auth";
import { NativeSignIn } from "./sign-in";
export const dynamic = "force-dynamic";
export default async function NativeSignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parsed = nativeAuthorization.safeParse(await searchParams);
  if (!parsed.success) return <main className="p-8">This connection request is invalid. Start again from the Windows app.</main>;
  return <NativeSignIn callbackUrl={`/api/native/auth/authorize?${new URLSearchParams(parsed.data)}`} />;
}
