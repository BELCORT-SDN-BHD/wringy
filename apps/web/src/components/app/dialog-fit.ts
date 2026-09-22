/**
 * The class every dialog in the prototype puts on its content box so the dialog
 * can never grow taller than the viewport.
 *
 * The official `DialogContent` and `AlertDialogContent` are
 * `fixed top-1/2 left-1/2 -translate-y-1/2` with no height bound. A dialog whose
 * content is taller than the viewport therefore hangs off both edges, and because
 * it is `position: fixed` there is nothing to scroll: the footer buttons become
 * unreachable for a pointer, a keyboard and Playwright alike. That is what broke
 * the partial-offer consent at 320×568, where the offer dialog is ~700px tall.
 *
 * Fixing it inside `src/components/ui/**` is not allowed — those are upstream
 * registry sources (apps/web/README.md: "Do not hand-edit them: re-run the CLI")
 * — so the bound is applied at every call site through this one constant.
 *
 * `100svh` is the small viewport height, so a mobile browser's collapsing URL bar
 * cannot push the footer under the chrome. The 1.5rem keeps a visible margin, which
 * is also how a reader can tell the dialog is a dialog and not a page.
 */
export const DIALOG_FIT_CLASS = 'max-h-[calc(100svh-1.5rem)] overflow-y-auto overscroll-contain';
