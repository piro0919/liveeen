import type messages from '../messages/ja.json';

// 文言のキーを型で確かめる。日本語のファイルを正とし、ほかの言語はこれと同じ形にそろえる
declare module 'next-intl' {
  interface AppConfig {
    Locale: 'ja';
    Messages: typeof messages;
  }
}
