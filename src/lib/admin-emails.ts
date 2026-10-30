/** ADMIN_EMAILS（カンマ区切り）に、そのメールアドレスがあるか。大文字と小文字は区別しない */
export function isAdminEmail(adminEmails: string | undefined, email: string): boolean {
  if (!adminEmails) return false;
  const wanted = email.trim().toLowerCase();
  return adminEmails
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .some((entry) => entry !== '' && entry === wanted);
}
