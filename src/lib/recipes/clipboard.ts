// Clipboard writes. navigator.clipboard only exists in secure contexts, and testing on a phone
// over plain-HTTP LAN must still work, so fall back to a temporary <textarea> + execCommand.

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied or document not focused: try the legacy path.
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    // Inside an open modal <dialog> the rest of the page is inert, so put the helper there.
    (document.activeElement?.closest("dialog") ?? document.body).append(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  } catch {
    return false;
  }
}
