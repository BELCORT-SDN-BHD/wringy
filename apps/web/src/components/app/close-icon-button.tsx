'use client';

/**
 * The icon-only close control for a product dialog or sheet, with a LOCALIZED
 * accessible name.
 *
 * The official `DialogContent` and `SheetContent` render this control themselves
 * with a hardcoded English `sr-only` "Close", and `sr-only` is clipped rather than
 * hidden, so that English word is the control's accessible name in ms-MY and
 * zh-Hans-MY too — on the demo-tools sheet at 390px and on the consent dialog that
 * moves money. localization-v1 requires the accessible name to come from the same
 * stable copy keys as the visible text ("按钮、标签、辅助说明、无障碍名称…均从同一组稳定文案
 * 键读取"), and `src/components/ui/**` holds upstream registry sources the project
 * re-runs from the CLI rather than hand-edits (kickoff record, apps/web/README.md).
 *
 * So a call site passes `showCloseButton={false}` and renders this instead. It is
 * the same call-site workaround shape as `DIALOG_FIT_CLASS`, and it keeps the same
 * placement, variant and icon as the official control.
 */

import { XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { DialogClose } from '@/components/ui/dialog';
import { SheetClose } from '@/components/ui/sheet';

function Label() {
  const t = useTranslations('common.shell');
  return <span className="sr-only">{t('close')}</span>;
}

export function DialogCloseIcon({ className }: { className?: string }) {
  return (
    <DialogClose data-slot="dialog-close" asChild>
      <Button variant="ghost" size="icon-sm" className={className ?? 'absolute top-2 right-2'}>
        <XIcon />
        <Label />
      </Button>
    </DialogClose>
  );
}

export function SheetCloseIcon({ className }: { className?: string }) {
  return (
    <SheetClose data-slot="sheet-close" asChild>
      <Button variant="ghost" size="icon-sm" className={className ?? 'absolute top-3 right-3'}>
        <XIcon />
        <Label />
      </Button>
    </SheetClose>
  );
}
