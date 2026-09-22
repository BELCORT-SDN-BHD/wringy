import { describe, expect, it } from 'vitest';

import { LOCALES, NAMESPACES, messagesByLocale } from './messages';

type Tree = { [key: string]: string | Tree };

/**
 * Paths are kept as arrays, not dotted strings: notification keys such as
 * `campaign.published` contain a dot themselves, so a dotted path would not be
 * walkable.
 */
function entries(tree: Tree, prefix: string[] = []): Array<[string[], string]> {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = [...prefix, key];
    return typeof value === 'string'
      ? ([[path, value]] as Array<[string[], string]>)
      : entries(value as Tree, path);
  });
}

function read(tree: Tree, path: string[]): string | Tree | undefined {
  return path.reduce<string | Tree | undefined>((node, part) => {
    if (node === undefined || typeof node === 'string') return undefined;
    return node[part];
  }, tree);
}

const label = (path: string[]) => path.join(' › ');

const REFERENCE_LOCALE = 'en-MY';

describe('message catalogue', () => {
  it('has all three locales', () => {
    expect(Object.keys(messagesByLocale).sort()).toEqual([...LOCALES].sort());
  });

  it('has all eight namespaces in every locale', () => {
    for (const locale of LOCALES) {
      expect(Object.keys(messagesByLocale[locale]).sort()).toEqual([...NAMESPACES].sort());
    }
  });

  it.each(NAMESPACES)('namespace %s has identical key sets across locales', (namespace) => {
    const reference = entries(messagesByLocale[REFERENCE_LOCALE][namespace] as Tree)
      .map(([path]) => label(path))
      .sort();

    for (const locale of LOCALES) {
      if (locale === REFERENCE_LOCALE) continue;
      const actual = entries(messagesByLocale[locale][namespace] as Tree)
        .map(([path]) => label(path))
        .sort();

      // Report which key drifted; a bare length check hides that.
      expect({
        missing: reference.filter((key) => !actual.includes(key)),
        extra: actual.filter((key) => !reference.includes(key)),
      }).toEqual({ missing: [], extra: [] });
    }
  });

  it.each(NAMESPACES)('namespace %s has no empty strings', (namespace) => {
    for (const locale of LOCALES) {
      const empty = entries(messagesByLocale[locale][namespace] as Tree)
        .filter(([, value]) => value.trim() === '')
        .map(([path]) => label(path));
      expect(empty, `empty strings in ${locale}/${namespace}`).toEqual([]);
    }
  });

  it.each(NAMESPACES)(
    'namespace %s uses the same interpolation parameters in every locale',
    (namespace) => {
      const params = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      const reference = messagesByLocale[REFERENCE_LOCALE][namespace] as Tree;

      for (const locale of LOCALES) {
        if (locale === REFERENCE_LOCALE) continue;
        const tree = messagesByLocale[locale][namespace] as Tree;

        for (const [path, referenceValue] of entries(reference)) {
          const value = read(tree, path);
          expect(typeof value, `${locale}/${namespace} ${label(path)} is missing`).toBe('string');
          expect(params(value as string), `${locale}/${namespace} ${label(path)} parameters`).toEqual(
            params(referenceValue),
          );
        }
      }
    },
  );

  it('shows language names in their own language in every locale', () => {
    for (const locale of LOCALES) {
      const names = (
        messagesByLocale[locale].common as unknown as { locale: Record<string, string> }
      ).locale;
      expect(names['en-MY']).toBe('English');
      expect(names['ms-MY']).toBe('Bahasa Melayu');
      expect(names['zh-Hans-MY']).toBe('简体中文');
    }
  });

  it('covers every notification kind with title, body and a simulated email', () => {
    // Kinds are nested (`claim` › `reserved` › `title`) because next-intl treats
    // a dot as nesting, so the leaf groups are what must carry the four fields.
    const kinds = messagesByLocale[REFERENCE_LOCALE].notifications.kinds as unknown as Tree;
    const groups = new Map<string, string[]>();

    for (const [path] of entries(kinds)) {
      const kind = path.slice(0, -1).join('.');
      groups.set(kind, [...(groups.get(kind) ?? []), path.at(-1) as string]);
    }

    expect(groups.size).toBeGreaterThan(0);
    for (const [kind, fields] of groups) {
      expect(fields.sort(), `notification kind ${kind}`).toEqual([
        'body',
        'emailBody',
        'emailSubject',
        'title',
      ]);
    }
  });
});
