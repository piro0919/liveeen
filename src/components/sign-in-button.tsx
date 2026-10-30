'use client';

import { signIn } from '@/lib/auth-client';

export function SignInButton() {
  return (
    <button type="button" className="rounded border px-4 py-2" onClick={() => void signIn()}>
      Google でログイン
    </button>
  );
}
