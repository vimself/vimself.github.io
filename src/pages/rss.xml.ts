import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { allNotes, data } from '../lib/notes';
import { site } from '../config/site';

export async function GET(context: APIContext) {
  const notes = await allNotes();
  return rss({
    title: `${site.title} · ${site.author}`,
    description: site.description,
    site: context.site ?? site.url,
    items: notes.map((n) => {
      const d = data(n);
      return {
        title: d.name,
        description: d.lede,
        link: d.url,
        pubDate: d.updated ?? d.created ?? undefined,
        categories: [d.domain, ...(d.kind ? [d.kind] : []), ...d.topics],
      };
    }),
    customData: `<language>zh-CN</language>`,
  });
}
