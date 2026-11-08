type TrapOptions = { onclose?: () => void };
type Trap = { node: HTMLElement; close?: () => void };
const _traps: Trap[] = [];
const _inertState = new Map<HTMLElement, boolean>();
const _selector = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';
let _previousOverflow = '';

function _focusable(node: HTMLElement): HTMLElement[] {
  return Array.from(node.querySelectorAll<HTMLElement>(_selector)).filter(
    (element) => !element.closest('[inert]') && element.getClientRects().length > 0
  );
}

function _syncLayer(): void {
  for (const [element, inert] of _inertState) element.inert = inert;
  _inertState.clear();
  let branch: HTMLElement | undefined = _traps.at(-1)?.node;
  while (branch && branch !== document.body) {
    for (const sibling of branch.parentElement?.children || []) {
      if (sibling instanceof HTMLElement && sibling !== branch && sibling.getAttribute('role') !== 'status') {
        _inertState.set(sibling, sibling.inert);
        sibling.inert = true;
      }
    }
    branch = branch.parentElement || undefined;
  }
  document.body.style.overflow = _traps.length ? 'hidden' : _previousOverflow;
}

function _close(trap: Trap): void {
  if (trap.close) return trap.close();
  // Compatibility with existing modal entry points until each feature is rebuilt.
  const close = trap.node.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')
    || Array.from(trap.node.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'close');
  close?.click();
}

function _handleKey(event: KeyboardEvent, trap: Trap): void {
  if (_traps.at(-1) !== trap) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopImmediatePropagation();
    _close(trap);
  } else if (event.key === 'Tab') {
    const items = _focusable(trap.node);
    const first = items[0] || trap.node;
    const last = items.at(-1) || trap.node;
    const outside = !trap.node.contains(document.activeElement);
    if (!items.length || outside || (event.shiftKey && document.activeElement === first)
      || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }
}

/** Stack-aware modal focus, background inertness, Escape and trigger restoration. */
export function focusTrap(node: HTMLElement, options: TrapOptions = {}): { destroy: () => void } {
  const previous = document.activeElement;
  const trap: Trap = { node, close: options.onclose };
  if (!_traps.length) _previousOverflow = document.body.style.overflow;
  _traps.push(trap);
  _syncLayer();
  const frame = requestAnimationFrame(() => {
    if (_traps.at(-1) === trap) (_focusable(node)[0] || node).focus();
  });
  const handleKey = (event: KeyboardEvent): void => _handleKey(event, trap);
  document.addEventListener('keydown', handleKey, true);
  return {
    destroy(): void {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKey, true);
      const wasTop = _traps.at(-1) === trap;
      _traps.splice(_traps.indexOf(trap), 1);
      _syncLayer();
      if (wasTop && previous instanceof HTMLElement && previous.isConnected && !previous.closest('[inert]')) {
        previous.focus({ preventScroll: true });
      }
    },
  };
}
