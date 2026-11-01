import type { Metadata } from 'next';
import Form from 'next/form';
import { getTranslations } from 'next-intl/server';
import { ChannelList } from '@/components/channel-list';
import { searchChannels } from '@/lib/channels';
import { normalizeSearchQuery } from '@/lib/search';
import { ui } from '@/lib/ui';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('search'))('title') };
}

/** 配信者を探す。配信していない人も見つかる */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const t = await getTranslations('search');
  const query = normalizeSearchQuery((await searchParams).q);
  const channels = query ? await searchChannels(query) : [];
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className="sr-only">{t('heading')}</h1>
      <Form action="/search" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query ?? ''}
          autoFocus={!query}
          enterKeyHint="search"
          aria-label={t('input')}
          placeholder={t('input')}
          className={`flex-1 ${ui.input}`}
        />
        <button type="submit" className={ui.tonalButton}>
          {t('submit')}
        </button>
      </Form>
      {query &&
        (channels.length > 0 ? (
          <ChannelList channels={channels} />
        ) : (
          <p className="text-muted">{t('empty')}</p>
        ))}
    </main>
  );
}
