import { useEffect, useRef } from 'react';
import { Keyboard } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import type { HostNav } from './host-context';

const SHORTCUTS: [string, string][] = [
  ['→', 'Next stage'],
  ['←', 'Previous stage'],
  ['R', 'Reveal or hide the answer'],
  ['T', 'Start the stage countdown'],
  ['P', 'Pause or resume the countdown'],
  ['Space', 'Same as P, when no button has focus'],
];

const TYPING = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"], [role="combobox"]';
/** Space activates these itself. */
const PRESSABLE = 'button, a[href], summary, [role="button"], [role="checkbox"], [role="switch"], [role="radio"], [role="menuitem"], [role="tab"], [role="option"]';
/** Arrow keys move focus inside these. */
const ARROW_OWNERS = '[role="radiogroup"], [role="tablist"], [role="toolbar"], [role="listbox"], [role="menu"], [role="slider"], [role="grid"]';
const OPEN_LAYER = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

/**
 * Host console keys: → next, ← back, R reveal, T timer, P (or Space) pause/resume. Ignored while typing,
 * with a modifier held, on key repeat, or while a dialog, menu or popover is open.
 */
export function useHostShortcuts(nav: HostNav, enabled = true) {
  const ref = useRef(nav);
  useEffect(() => {
    ref.current = nav;
  }, [nav]);
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.isComposing) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest(TYPING) || (target instanceof HTMLElement && target.isContentEditable)) return;
      if (document.querySelector(OPEN_LAYER)) return;
      const n = ref.current;
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowLeft':
          if (target?.closest(ARROW_OWNERS)) return;
          e.preventDefault();
          if (e.key === 'ArrowRight') n.next();
          else n.back();
          return;
        case 'r':
        case 'R':
          e.preventDefault();
          n.toggleReveal();
          return;
        case 't':
        case 'T':
          e.preventDefault();
          n.startTimer();
          return;
        case 'p':
        case 'P':
          // Always available: after a score tap the button keeps focus, and Space would press it again.
          if (n.togglePause()) e.preventDefault();
          return;
        case ' ':
          if (target?.closest(PRESSABLE)) return;
          if (n.togglePause()) e.preventDefault();
          return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}

export function ShortcutsButton() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="h-11" aria-label="Keyboard shortcuts">
          <Keyboard /> <span className="hidden sm:inline">Shortcuts</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-72 p-3">
        <p className="text-sm font-semibold text-ink">Keyboard shortcuts</p>
        <dl className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 text-[13px]">
          {SHORTCUTS.map(([k, label]) => (
            <div key={k} className="contents">
              <dt>
                <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-sm border border-line-strong bg-ground px-1.5 font-mono text-xs font-semibold text-ink">
                  {k}
                </kbd>
              </dt>
              <dd className="text-ink-2">{label}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2.5 text-xs text-ink-3">They work while the cursor is not in a text box.</p>
      </PopoverContent>
    </Popover>
  );
}
