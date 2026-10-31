'use client';

import { createAuthClient } from 'better-auth/react';

/** ログインの窓口（ブラウザの側） */
const authClient = createAuthClient();

/**
 * Google でログインする。戻ってくる先は今の画面。
 * Google の画面はアカウントの言語で出るので、hl でサイトに合わせて日本語にする
 */
export function signIn() {
  return authClient.signIn.social({
    provider: 'google',
    callbackURL: window.location.href,
    additionalParams: { hl: 'ja' },
  });
}

/** ログアウトする */
export function signOut() {
  return authClient.signOut();
}
