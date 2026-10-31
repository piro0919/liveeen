/** ADMIN_EMAILS（カンマ区切り）に、そのメールアドレスがあるか。大文字と小文字は区別しない */
export function isAdminEmail(adminEmails: string | undefined, email: string): boolean {
  if (!adminEmails) return false;
  const wanted = email.trim().toLowerCase();
  return adminEmails
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .some((entry) => entry !== '' && entry === wanted);
}

/** ADMIN_EMAILS（カンマ区切り）の宛先。空の項目と重複は除く */
export function adminEmailList(adminEmails: string | undefined): string[] {
  if (!adminEmails) return [];
  return [
    ...new Set(
      adminEmails
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry !== ''),
    ),
  ];
}
