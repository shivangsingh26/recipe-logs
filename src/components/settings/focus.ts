/**
 * Focuses `el` once no modal <dialog> is open. While a modal is open the rest of the page
 * is inert, so focusing a button behind it would silently fail and leave focus on <body>.
 */
export function focusWhenDialogsClose(el: HTMLElement | null, framesLeft = 30): void {
  if (!el) return;
  if (document.querySelector("dialog[open]") && framesLeft > 0) {
    requestAnimationFrame(() => focusWhenDialogsClose(el, framesLeft - 1));
    return;
  }
  if (el.isConnected) el.focus();
}
