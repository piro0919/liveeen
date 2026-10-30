'use client';

import { createAuthClient } from 'better-auth/react';

/** ログインの窓口（ブラウザの側） */
const authClient = createAuthClient();

/** Google でログインする。戻ってくる先は今の画面 */
export function signIn() {
  return authClient.signIn.social({ provider: 'google', callbackURL: window.location.href });
}
