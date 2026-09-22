import { notFound } from 'next/navigation';

/**
 * Any /internal/<path> that is not a page renders the internal build's own
 * not-found page ((internal)/not-found.tsx) inside the internal root layout,
 * with its banner and without the demo, instead of falling through to the
 * demo's catch-all.
 */
export default function UnmatchedInternalRoute(): never {
  notFound();
}
