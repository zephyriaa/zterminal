# Production domain migration

6 October 2026. The user authorized moving production to https://zterminal.dpdns.org.

The Cloudflare dashboard confirms that the domain is already a Custom Domain on the existing zterminal-web Worker. DNS and TLS resolve successfully. Wrangler now declares that existing mapping, and NEXTAUTH_URL / NEXTAUTH_URL_INTERNAL use the new origin. Old workers.dev requests receive a path- and query-preserving permanent redirect to the new domain. The existing Worker, database, artifact bucket and service binding remain authoritative.

The existing ZTerminal Web Google OAuth client was updated through the user's browser. Its new authorized JavaScript origin is https://zterminal.dpdns.org and its callback is https://zterminal.dpdns.org/api/auth/callback/google. Google confirmed the client was saved and reopening verified both persisted values. Existing credentials and scopes were preserved.

Desktop launch URLs, hosted preview workflows, release tooling, live checks and calendar identification now use the new domain. The Python Helper permits the exact new HTTPS origin while retaining its existing pairing and token boundary. Legacy release-note URLs remain accepted for previously published envelopes.

Validation before deployment: TypeScript and six release tests passed. The new-origin Helper pairing/auth boundary check passed. The broader Python helper suite encountered four strategy-child process failures in the local environment, and a subsequent broader API check encountered a Windows connection-abort error; these are not claimed as successful checks. Browser storage and cookies are scoped by origin: moving the hostname does not copy browser-only layouts, drafts, paired tokens or login cookies. Existing cloud records and Helper archives remain in their original stores. Previously installed desktop binaries need rebuilding to embed the new launch URL; no new installer is published by this web deployment.

Release verification must confirm the Linux Cloudflare build/deployment, new-origin provider callback URLs, old-origin redirects, and public/terminal browser journeys. A Google authorization screen alone is not evidence of a granted callback.

## Verified release and HTTPS follow-up

Commits 3bc4c62 and d4f17b6 deployed successfully through production runs 37506120393 and 37506873854. The latter fixes an OpenNext empty-wildcard redirect at the old homepage. Live checks verified 308 redirects for the homepage, documentation, terminal query strings and authentication providers. Public/theme browser journeys passed on the new origin. Google sign-in returned to the new-domain terminal with the existing server identity. The Google consent branding home link was also saved as https://zterminal.dpdns.org.

On 7 October, certificate validation succeeded, and Cloudflare showed active managed certificates expiring 30 December. Plain HTTP nevertheless returned 200 because Always Use HTTPS was disabled. The setting is now enabled at the edge. HTTP requests for the homepage, a nested documentation path, a terminal query and the session endpoint now return 301 to their exact HTTPS equivalents; HTTPS responses return 200. This requires no application rebuild. Proof is saved in artifacts/https-followup/https-enabled.png.

In the user's browser, the account initially verified and reported Workspaces synced. Reload then reproduced a blocked /api/auth/session request (ERR_BLOCKED_BY_CLIENT). Session persistence in that browser remains unverified; its blocking rule was not disabled or bypassed. Direct anonymous HTTPS session checks succeed. The single prior Worker 1102 error did not recur in these route checks; this is not proof that resource-limit failures cannot recur.
