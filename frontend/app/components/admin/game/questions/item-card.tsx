import { useId, useRef } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { GAME_MAX_QUESTIONS } from '@hrrl/shared';
import { Card } from '~/components/admin/ui';
import { Button } from '~/components/ui/button';
import { useEditor } from './editor-context';
import { ErrorText, IconAction } from './fields';
import { LIST_MIN, LIST_PATH, ROUND_NO, count, itemName, listOf, nounFor, type ListName } from './model';

/** One round: a header card (title, summary, round settings), then its item cards. */
export function RoundSection({
  id,
  eyebrow,
  title,
  srTitlePrefix,
  summary,
  header,
  children,
}: {
  id: string;
  /** The grey strip, e.g. "Round 1 · Situations". */
  eyebrow: string;
  title: string;
  srTitlePrefix?: string;
  summary: string;
  header?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="min-w-0">
      <Card>
        <div className="rounded-t-lg bg-ground-2 px-5 py-2 text-[13px] font-semibold text-ink-2">{eyebrow}</div>
        <div className="grid gap-4 px-5 pt-3 pb-5">
          <div>
            <h2 id={`${id}-title`} className="text-lg leading-7 font-semibold text-ink">
              {srTitlePrefix ? <span className="sr-only">{srTitlePrefix} </span> : null}
              {title}
            </h2>
            <p className="mt-0.5 text-sm leading-5 text-ink-3">{summary}</p>
          </div>
          {header}
        </div>
      </Card>
      {children}
    </section>
  );
}

export function ItemList({ list, children }: { list: ListName; children: React.ReactNode }) {
  return (
    <ol data-list={list} className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-3">
      {children}
    </ol>
  );
}

/** One question in a round: its number, Move up / Move down / Delete, then its fields. */
export function ItemCard({
  list,
  index,
  total,
  srPrefix,
  aside,
  children,
}: {
  list: ListName;
  index: number;
  total: number;
  /** Read before the heading by screen readers, e.g. "Round 4", where the same name is used in another round. */
  srPrefix?: string;
  aside?: React.ReactNode;
  children: (ids: { headingId: string }) => React.ReactNode;
}) {
  const { locked, move, remove } = useEditor();
  const headingId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const upRef = useRef<HTMLButtonElement>(null);
  const downRef = useRef<HTMLButtonElement>(null);
  const name = itemName(list, index);
  const lower = name.charAt(0).toLowerCase() + name.slice(1);
  const subject = srPrefix ? `${lower} of ${srPrefix.toLowerCase()}` : lower;
  const min = LIST_MIN[list];
  const minHint = total <= min ? `Round ${ROUND_NO[list]} needs at least ${count(min, nounFor(list, 1), nounFor(list, 2))}` : undefined;

  // The card moves with its button; keep the focus on a button that still works and the card on screen.
  const moveBy = (by: -1 | 1) => {
    const to = index + by;
    move(list, index, by);
    requestAnimationFrame(() => {
      const keep = to === 0 ? downRef.current : to === total - 1 ? upRef.current : by < 0 ? upRef.current : downRef.current;
      keep?.focus({ preventScroll: true });
      cardRef.current?.scrollIntoView({ block: 'nearest' });
    });
  };

  return (
    <li>
      <div ref={cardRef} className="rounded-lg bg-surface shadow-card">
        <div className="flex min-h-14 items-center gap-2 pt-1.5 pr-1.5 pl-5">
          <h3
            id={headingId}
            data-heading=""
            tabIndex={-1}
            className="rounded-sm text-[13px] font-semibold text-ink-3 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {srPrefix ? <span className="sr-only">{srPrefix}, </span> : null}
            {name}
          </h3>
          {aside}
          {!locked ? (
            <div className="ml-auto flex shrink-0 items-center">
              <IconAction buttonRef={upRef} label={`Move ${subject} up`} tip="Move up" disabled={index === 0} onClick={() => moveBy(-1)}>
                <ArrowUp />
              </IconAction>
              <IconAction buttonRef={downRef} label={`Move ${subject} down`} tip="Move down" disabled={index === total - 1} onClick={() => moveBy(1)}>
                <ArrowDown />
              </IconAction>
              <IconAction label={`Delete ${subject}`} tip="Delete" blockedHint={minHint} onClick={() => remove(list, index)}>
                <Trash2 />
              </IconAction>
            </div>
          ) : null}
        </div>
        <div className="grid gap-4 px-5 pt-1 pb-5">{children({ headingId })}</div>
      </div>
    </li>
  );
}

/** A problem with the round's list as a whole (shown under the list). */
export function ListIssue({ list }: { list: ListName }) {
  const { issue } = useEditor();
  const message = issue(LIST_PATH[list]);
  return message ? (
    <div className="mt-3 px-1">
      <ErrorText anchor>{message}</ErrorText>
    </div>
  ) : null;
}

/** Add a question to the round, until the round is full. */
export function AddItem({ list, label }: { list: ListName; label: string }) {
  const { q, locked, add } = useEditor();
  if (locked) return null;
  const n = listOf(q, list).length;
  if (n >= GAME_MAX_QUESTIONS) {
    return (
      <p className="mt-3 px-1 text-[13px] leading-5 text-ink-3">
        Round {ROUND_NO[list]} has {GAME_MAX_QUESTIONS} {nounFor(list, 2)}, the most a round can hold. Delete one to add another.
      </p>
    );
  }
  return (
    <Button type="button" variant="outline" className="mt-3 h-11" onClick={() => add(list)}>
      <Plus /> {label}
    </Button>
  );
}
