# React + TypeScript + Vite + shadcn/ui

This is a template for a new Vite project with React, TypeScript, and shadcn/ui.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `src/components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button"
```

## Wringy color maintenance

See [color policy](../color-policy.md) and [handoff](../handoff.md). `src/index.css` is canonical; `provenance/palette.json` mirrors its 43 color variables. Keep all 61 official UI files unchanged. Run `npm run verify:source`, `npm run export`, `npm run test:browser`, then `node tests/color-allocation.cjs`. The export at `../output/Wringy-Design-System.html` is self-contained and does not require the preview server.
