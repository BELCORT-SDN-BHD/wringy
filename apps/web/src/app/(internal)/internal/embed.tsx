import type { ReactNode } from 'react';

/**
 * A placeholder no catalogue ever contains (a private-use code point), handed to
 * `t()` for an argument that must render as an element rather than as text: a
 * language name carrying its own `lang` (M2-04; m2-04-code-review.md R10), an
 * `InstantText` inside "Saved {time}". The sentence stays one catalogue string
 * in every language, so word order is the translator's, not the component's.
 */
export const SLOT = '';

/** `text` with its `SLOT` replaced by `node`; unchanged when the slot is absent. */
export function withSlot(text: string, node: ReactNode): ReactNode {
  const at = text.indexOf(SLOT);
  if (at === -1) return text;
  return (
    <>
      {text.slice(0, at)}
      {node}
      {text.slice(at + SLOT.length)}
    </>
  );
}
