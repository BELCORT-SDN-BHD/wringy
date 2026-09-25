// A deliberate dependency-direction violation (M2-02 R17).
//
// scripts/check-dependency-direction.mjs copies this file to
// apps/web/src/lib/auth/__dependency-violation__.ts, runs dependency-cruiser,
// asserts that the widened rule `internal-not-to-demo` rejects it, and deletes
// the copy. It is never compiled or shipped from this folder.
//
// `internal-not-to-demo` used to cover only apps/web/src/app/(internal)/. M2-02
// added internal-build code outside that route group — the proxy, this auth
// library and the auth route handlers — and none of it may reach the demo
// simulator or its persisted store either.
import { useDemoStore } from '@/store/demo-store';

export const leakedDemoStore = useDemoStore;
