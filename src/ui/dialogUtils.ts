const registeredDialogs: HTMLDialogElement[] = [];
let escapeListenerAttached = false;

/** Makes a non-modal `.show()` dialog draggable by its header — shared by every floating panel. */
export function makeDialogDraggable(dialog: HTMLDialogElement, header: HTMLElement): void {
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  function onDragMove(e: PointerEvent): void {
    const x = Math.min(Math.max(e.clientX - dragOffsetX, 0), window.innerWidth - dialog.offsetWidth);
    const y = Math.min(Math.max(e.clientY - dragOffsetY, 0), window.innerHeight - dialog.offsetHeight);
    dialog.style.left = `${x}px`;
    dialog.style.top = `${y}px`;
  }

  function onDragEnd(): void {
    header.classList.remove("is-dragging");
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", onDragEnd);
  }

  header.addEventListener("pointerdown", (e) => {
    const rect = dialog.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    header.classList.add("is-dragging");
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragEnd);
  });
}

/** .showModal() closes on Escape natively; .show() doesn't. Registers `dialog` with a single
 * shared keydown listener (attached once) that closes it — and every other registered dialog
 * that's open — on Escape. */
export function closeOnEscape(dialog: HTMLDialogElement): void {
  registeredDialogs.push(dialog);
  if (escapeListenerAttached) return;
  escapeListenerAttached = true;
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    for (const d of registeredDialogs) {
      if (d.open) d.close();
    }
  });
}
