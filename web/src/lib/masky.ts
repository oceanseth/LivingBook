// "Login with Masky" — OAuth 2.0 authorization-code flow with PKCE (public client).
// Flow per masky.md: authorize at masky.ai/oauth-authorize.html, exchange the
// code at /api/oauth/token with a code_verifier, then the access_token is a
// scoped mky_ key usable against the whole Masky API.

const MASKY_ORIGIN = 'https://masky.ai';
const CLIENT_ID = import.meta.env.VITE_MASKY_CLIENT_ID as string | undefined;
const SCOPES = 'profile avatars:read generate';

const VERIFIER_KEY = 'masky_pkce_verifier';
const STATE_KEY = 'masky_oauth_state';
const SESSION_KEY = 'masky_session';

export interface MaskySession {
  accessToken: string;
  scope: string;
  sub: string;
  name: string;
  picture: string | null;
  avatarId: string | null;
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function randomToken(byteLength = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

async function sha256base64url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return base64url(new Uint8Array(digest));
}

function redirectUri(): string {
  return `${window.location.origin}/callback`;
}

export function isConfigured(): boolean {
  return Boolean(CLIENT_ID);
}

export async function login(): Promise<void> {
  if (!CLIENT_ID) throw new Error('VITE_MASKY_CLIENT_ID is not set — see scripts/register-oauth-client.sh');
  const verifier = randomToken(48);
  const state = randomToken(16);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri(),
    scope: SCOPES,
    state,
    code_challenge: await sha256base64url(verifier),
    code_challenge_method: 'S256',
  });
  window.location.assign(`${MASKY_ORIGIN}/oauth-authorize.html?${params}`);
}

/** Call on page load. Completes the flow if we're on /callback?code=… */
export async function handleCallback(): Promise<MaskySession | null> {
  if (window.location.pathname !== '/callback') return null;
  const query = new URLSearchParams(window.location.search);
  const code = query.get('code');
  const state = query.get('state');
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  const expectedState = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  if (!code || !verifier) return null;
  if (!state || state !== expectedState) throw new Error('OAuth state mismatch — possible CSRF, login aborted.');

  const tokenRes = await fetch(`${MASKY_ORIGIN}/api/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      client_id: CLIENT_ID,
      code_verifier: verifier,
    }),
  });
  if (!tokenRes.ok) throw new Error(`Token exchange failed (${tokenRes.status}): ${await tokenRes.text()}`);
  const token = await tokenRes.json();

  const infoRes = await fetch(`${MASKY_ORIGIN}/api/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!infoRes.ok) throw new Error(`userinfo failed (${infoRes.status})`);
  const info = await infoRes.json();

  const session: MaskySession = {
    accessToken: token.access_token,
    scope: token.scope ?? info.scope ?? '',
    sub: info.sub,
    name: info.name,
    picture: info.picture ?? token.avatar?.picture ?? null,
    avatarId: info.avatar_id ?? token.avatar?.id ?? null,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.history.replaceState(null, '', '/');
  return session;
}

export function currentSession(): MaskySession | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MaskySession;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
}
