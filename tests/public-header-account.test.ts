import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { SessionProvider } from "next-auth/react";

// createElement receives children separately; NextAuth's prop type requires
// children inside the props object even when a third argument supplies them.
const AccountSessionProvider = SessionProvider as React.ComponentType<Omit<React.ComponentProps<typeof SessionProvider>, "children">>;

// Mock CSS imports for Node environment before loading component
require.extensions[".css"] = () => ({});

let PublicHeaderAccount: React.ComponentType<{ onNavigate?: () => void }>;

test.before(async () => {
  const mod = await import("../src/components/public/public-header-account");
  PublicHeaderAccount = mod.PublicHeaderAccount;
});

const root = process.cwd();
const read = (file: string) => readFileSync(join(root, file), "utf8");

test("PublicHeaderAccount: renders signed-out state when session is null", () => {
  assert.ok(PublicHeaderAccount, "Component must be loaded");
  const html = ReactDOMServer.renderToString(
    React.createElement(AccountSessionProvider, {
      session: null,
    }, React.createElement(PublicHeaderAccount))
  );

  // Trigger button exists with correct accessibility attributes
  assert.match(html, /<button[^>]+type="button"/);
  assert.match(html, /title="Account: Sign in or manage profile"/);
  assert.match(html, /aria-label="Account and sign-in menu"/);
  assert.match(html, /data-slot="dropdown-menu-trigger"/);

  // Rendered text labels
  assert.match(html, />Account</);
  assert.match(html, />Sign in or manage profile</);

  // Default user SVG avatar is present
  assert.match(html, /<svg[^>]+viewBox="0 0 24 24"/);
  assert.match(html, /<polyline points="6 9 12 15 18 9"/);
});

test("PublicHeaderAccount: renders authenticated identity when valid user session exists", () => {
  const mockSession = {
    user: {
      name: "Senior Strategist",
      email: "strategist@zterminal.test",
      image: "https://lh3.googleusercontent.com/a/custom-avatar=s96-c",
    },
    expires: "2099-01-01T00:00:00.000Z",
  };

  const html = ReactDOMServer.renderToString(
    React.createElement(AccountSessionProvider, {
      session: mockSession,
    }, React.createElement(PublicHeaderAccount))
  );

  // Correct user info displayed
  assert.match(html, /title="Senior Strategist \(strategist@zterminal\.test\)"/);
  assert.match(html, /aria-label="Account menu for Senior Strategist"/);
  assert.match(html, />Senior Strategist</);
  assert.match(html, />strategist@zterminal\.test</);

  // Real avatar image is rendered with referrerPolicy
  assert.match(html, /<img[^>]+src="https:\/\/lh3\.googleusercontent\.com\/a\/custom-avatar=s96-c"/);
  assert.match(html, /referrerPolicy="no-referrer"/);
});

test("PublicHeaderAccount: handles authenticated session with email only (no display name)", () => {
  const mockSession = {
    user: {
      email: "quant-trader@zterminal.test",
    },
    expires: "2099-01-01T00:00:00.000Z",
  };

  const html = ReactDOMServer.renderToString(
    React.createElement(AccountSessionProvider, {
      session: mockSession,
    }, React.createElement(PublicHeaderAccount))
  );

  // Uses email as name and "Manage account" as subtitle
  assert.match(html, />quant-trader@zterminal\.test</);
  assert.match(html, />Manage account</);
  // Uses initial of email
  assert.match(html, />Q</);
  assert.match(html, /aria-label="Account menu for quant-trader@zterminal\.test"/);
});

test("PublicHeaderAccount: renders neutral reserved loading state with zero layout shift", () => {
  const html = ReactDOMServer.renderToString(
    React.createElement(AccountSessionProvider, {
      session: undefined,
    }, React.createElement(PublicHeaderAccount))
  );

  // Neutral loading indicator
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /aria-label="Resolving account session"/);
  assert.match(html, />Account</);
  assert.match(html, />Connecting\.\.\.</);

  // Still contains same layout slots: avatar container, meta, chevron
  assert.match(html, /<polyline points="6 9 12 15 18 9"/);
});

test("Architecture: single auth session provider wraps root layout and connects shared public header", () => {
  // 1. Root layout wraps application in ZTerminalSessionProvider
  const rootLayout = read("src/app/layout.tsx");
  assert.match(rootLayout, /import \{ ZTerminalSessionProvider \} from "@/);
  assert.match(rootLayout, /<ZTerminalSessionProvider>/);
  assert.match(rootLayout, /<\/ZTerminalSessionProvider>/);

  // 2. PublicHeader uses PublicHeaderAccount
  const publicHeader = read("src/components/public/public-header.tsx");
  assert.match(publicHeader, /import \{ PublicHeaderAccount \} from "\.\/public-header-account"/);
  assert.match(publicHeader, /<PublicHeaderAccount/);
  assert.doesNotMatch(publicHeader, /<Link[^>]+href="\/terminal\?account=signin"[^>]*className=\{styles\.accountCapsule\}/);

  // 3. PublicHeader is reused across public pages
  const landing = read("src/components/landing/ZTerminalLanding.tsx");
  assert.match(landing, /<PublicHeader hero \/>/);

  const docs = read("src/app/docs/layout.tsx");
  assert.match(docs, /<PublicHeader \/>/);

  const download = read("src/app/download/page.tsx");
  assert.match(download, /<PublicHeader \/>/);

  const research = read("src/app/research/page.tsx");
  assert.match(research, /<PublicHeader \/>/);

  const notFound = read("src/app/not-found.tsx");
  assert.match(notFound, /<PublicHeader \/>/);
});

test("PublicHeaderAccount: component source integrates real next-auth signIn, signOut, and auth config API", () => {
  const source = read("src/components/public/public-header-account.tsx");

  // Real next-auth functions used
  assert.match(source, /import \{ useSession, signIn, signOut \} from "next-auth\/react"/);
  assert.match(source, /signIn\("google"/);
  assert.match(source, /signOut\(\{ redirect: false \}\)/);

  // Queries runtime auth capability
  assert.match(source, /fetch\("\/api\/auth\/config"/);

  // Dropdown menu includes terminal links and profile management
  assert.match(source, /href="\/terminal"/);
  assert.match(source, /href="\/terminal\?account=profile"/);
  assert.match(source, /href="\/terminal\?panel=settings"/);
  assert.match(source, /href="\/terminal\?account=signin"/);

  // Handles auth error state
  assert.match(source, /authError/);
});

test("CSS: Account control and dropdown maintain responsive, accessible, non-overflowing rules", () => {
  const css = read("src/components/public/public-shared.module.css");

  // Text truncation prevents oversized button
  assert.match(css, /\.accountName\s*\{[^}]*text-overflow:\s*ellipsis/);
  assert.match(css, /\.accountStatus\s*\{[^}]*text-overflow:\s*ellipsis/);

  // Chevron rotation animation on open
  assert.match(css, /\.accountChevronOpen/);

  // Dropdown dark glass styling
  assert.match(css, /\.accountDropdown\s*\{[^}]*backdrop-filter/);
  assert.match(css, /\.accountDropdownItemDanger/);

  // Hero header compatibility
  assert.match(css, /\.heroHeader \.accountAvatar/);
  assert.match(css, /\.heroHeader \.syncDotOff/);
});

