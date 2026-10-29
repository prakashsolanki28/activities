import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useBlocker, type Blocker } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ListRestart, Loader2, TriangleAlert } from 'lucide-react';
import { CYBER_SURVIVOR, GAME_MAX_QUESTIONS, gameQuestionsSchema, questionsFingerprint, questionsOf, type AdminGame, type GameQuestions } from '@hrrl/shared';
import { MessageBar } from '~/components/admin/ui';
import { Button } from '~/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog';
import { ApiError, errorMessage } from '~/lib/api';
import { gameApi, gameKeys } from '~/lib/game-api';
import { newId } from '~/lib/ids';
import { GameStatusBadge } from '../bits';
import { EditorContext, type QuestionsEditor as EditorApi } from './editor-context';
import { LIST_MIN, ROUND_NO, collectIssues, focusSoon, itemName, listOf, maxOf, newItem, nounFor, num, stateFor, type EditorState, type Issue, type ListName } from './model';
import { Round1, Round2, Round3, Round4, Tiebreak } from './rounds';

const editorRoot = '[data-q-editor]';

/* An unsaved draft is kept in sessionStorage so a lock, a crash or a reload never loses the admin's work. */
const stashKey = (id: string) => `hrrl.game-questions-draft.${id}`;

function writeStash(id: string, q: GameQuestions) {
  try {
    sessionStorage.setItem(stashKey(id), JSON.stringify(q));
  } catch {
    /* storage unavailable: nothing to keep */
  }
}

function clearStash(id: string) {
  try {
    sessionStorage.removeItem(stashKey(id));
  } catch {
    /* ignore */
  }
}

/** `savedR2`: used for a draft kept before Round 2 changed shape (it had cards and no maxMarks), so its other rounds are not lost. */
function readStash(id: string, savedR2: GameQuestions['r2']): GameQuestions | null {
  try {
    const raw = sessionStorage.getItem(stashKey(id));
    if (!raw) return null;
    const q = JSON.parse(raw) as GameQuestions;
    if (!Array.isArray(q?.r1?.challenges) || !Array.isArray(q?.r3?.actions) || !Array.isArray(q?.r4?.situations) || !q?.tiebreak) return null;
    // An empty marks box was kept as null (JSON has no NaN).
    const marks: unknown = q.r2?.maxMarks;
    const maxMarks = typeof marks === 'number' ? marks : marks === null ? Number.NaN : savedR2.maxMarks;
    return { ...q, r2: { maxMarks }, r3: { ...q.r3, lesson: q.r3.lesson ?? '' } };
  } catch {
    return null;
  }
}

/** The headings of a round's item cards, in order. */
const headingAt = (list: ListName, index: number) => () =>
  document.querySelectorAll<HTMLElement>(`${editorRoot} [data-list="${list}"] [data-heading]`)[index];

/**
 * Add, edit, reorder and delete the questions of one team game. The draft lives here until Save;
 * the questions lock once the game starts.
 */
export function QuestionsEditor({ game, refreshError }: { game: AdminGame; refreshError: Error | null }) {
  const qc = useQueryClient();
  const locked = game.status !== 'setup';
  const saved = useMemo(() => questionsOf(game.content), [game.content]);
  const savedJson = useMemo(() => JSON.stringify(saved), [saved]);
  const savedFp = useMemo(() => questionsFingerprint(game.content), [game.content]);

  const [state, setState] = useState<EditorState>(() => stateFor(saved));
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const [showAll, setShowAll] = useState(false);
  // An earlier unsaved draft found in storage, offered back once the editor is editable and clean.
  const [stash, setStash] = useState<GameQuestions | null>(() => {
    const s = readStash(game._id, questionsOf(game.content).r2);
    return s && JSON.stringify(s) !== JSON.stringify(questionsOf(game.content)) ? s : null;
  });
  // Someone else saved while this draft was open.
  const [conflict, setConflict] = useState(false);
  const stateRef = useRef(state);
  const lockedRef = useRef(locked);
  useEffect(() => {
    stateRef.current = state;
    lockedRef.current = locked;
  });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const undoToasts = useRef(new Set<string | number>());
  // Fingerprint of the saved questions the draft started from: sent as basedOn so a stale tab cannot overwrite newer work.
  const basedFp = useRef(savedFp);

  const draftJson = useMemo(() => JSON.stringify(state.q), [state.q]);
  const dirty = !locked && draftJson !== savedJson;
  const issues = useMemo(() => (locked ? new Map<string, Issue>() : collectIssues(state.q)), [state.q, locked]);
  const problems = issues.size;

  const dismissUndos = useCallback(() => {
    for (const id of undoToasts.current) toast.dismiss(id);
    undoToasts.current.clear();
  }, []);
  const offerUndo = (message: string, undo: () => void) => {
    const id = toast(message, {
      duration: 8000,
      action: { label: 'Undo', onClick: undo },
      onDismiss: () => undoToasts.current.delete(id),
      onAutoClose: () => undoToasts.current.delete(id),
    });
    undoToasts.current.add(id);
  };

  // Follow the saved questions while nothing is being edited (another tab saved).
  // When the game locks, keep an edited draft in storage before showing the saved questions.
  const baseline = useRef(savedJson);
  useEffect(() => {
    const was = baseline.current;
    const clean = JSON.stringify(stateRef.current.q) === was;
    if (locked) {
      if (!clean) {
        writeStash(game._id, stateRef.current.q);
        setStash(stateRef.current.q);
      }
      baseline.current = savedJson;
      basedFp.current = savedFp;
      dismissUndos();
      setConflict(false);
      setState(stateFor(saved));
      setTouched(new Set());
      setShowAll(false);
    } else if (was !== savedJson && clean) {
      baseline.current = savedJson;
      basedFp.current = savedFp;
      setState(stateFor(saved));
    }
  }, [savedJson, savedFp, saved, locked, dismissUndos, game._id]);

  // Keep the draft in storage while it is unsaved.
  useEffect(() => {
    if (locked || !dirty) return;
    const t = setTimeout(() => writeStash(game._id, stateRef.current.q), 500);
    return () => clearTimeout(t);
  }, [draftJson, dirty, locked, game._id]);

  /* ---------------- edits ---------------- */

  const apply = useCallback((fn: (s: EditorState) => void) => {
    setState((prev) => {
      const next: EditorState = { q: structuredClone(prev.q) };
      fn(next);
      return next;
    });
  }, []);

  const edit = useCallback((fn: (q: GameQuestions) => void) => apply((s) => fn(s.q)), [apply]);

  const touch = useCallback((path: string) => setTouched((prev) => (prev.has(path) ? prev : new Set(prev).add(path))), []);

  const add = (list: ListName) => {
    // The id is made out here: React may run the updater twice.
    const item = newItem(list, newId());
    apply((s) => {
      const items = listOf(s.q, list);
      if (items.length >= GAME_MAX_QUESTIONS) return;
      items.push(structuredClone(item));
    });
    focusSoon(() => document.querySelector<HTMLElement>(`${editorRoot} [data-focus="${item.id}"]`));
  };

  const move = (list: ListName, index: number, by: -1 | 1) =>
    apply((s) => {
      const items = listOf(s.q, list);
      const to = index + by;
      if (to < 0 || to >= items.length) return;
      [items[index], items[to]] = [items[to]!, items[index]!];
    });

  /** Put a deleted item back after the item that preceded it (or first), wherever the list has moved to since. */
  const restore = (list: ListName, after: string | null, fallback: number, item: { id: string }) => {
    if (lockedRef.current) return;
    const cur = stateRef.current;
    const items = listOf(cur.q, list);
    if (items.length >= GAME_MAX_QUESTIONS) {
      toast.error(`Round ${ROUND_NO[list]} already has ${GAME_MAX_QUESTIONS} ${nounFor(list, 2)}. Delete one first.`);
      return;
    }
    const back = items.some((x) => x.id === item.id) ? { ...item, id: newId() } : item;
    const prev = after === null ? -2 : items.findIndex((x) => x.id === after);
    const at = after === null ? 0 : prev >= 0 ? prev + 1 : Math.min(fallback, items.length);
    apply((s) => {
      listOf(s.q, list).splice(at, 0, structuredClone(back));
    });
    focusSoon(headingAt(list, at));
  };

  const remove = (list: ListName, index: number) => {
    const items = listOf(state.q, list);
    const item = items[index];
    if (!item || items.length <= LIST_MIN[list]) return;
    const copy = structuredClone(item);
    const after = index === 0 ? null : (items[index - 1]?.id ?? null);
    const name = itemName(list, index);
    apply((s) => {
      listOf(s.q, list).splice(index, 1);
    });
    requestAnimationFrame(() => {
      const next = headingAt(list, Math.min(index, items.length - 2))();
      next?.focus({ preventScroll: true });
      next?.scrollIntoView({ block: 'nearest' });
    });
    // Only the latest delete can be undone.
    dismissUndos();
    offerUndo(`${name} deleted from Round ${ROUND_NO[list]}`, () => restore(list, after, index, copy));
  };

  /* ---------------- whole draft ---------------- */

  const resetMarks = () => {
    setTouched(new Set());
    setShowAll(false);
  };

  const discard = () => {
    const before = state;
    dismissUndos();
    clearStash(game._id);
    setConflict(false);
    setState(stateFor(saved));
    baseline.current = savedJson;
    basedFp.current = savedFp;
    resetMarks();
    headingRef.current?.focus({ preventScroll: true });
    offerUndo('Changes discarded', () => {
      if (!lockedRef.current) setState(before);
    });
  };

  const loadStandard = () => {
    const standard = questionsOf(CYBER_SURVIVOR);
    if (JSON.stringify(standard) === draftJson) {
      toast.info('This game already has the standard questions.');
      return;
    }
    dismissUndos();
    setState(stateFor(standard));
    resetMarks();
    toast.success('Standard questions loaded. Press Save changes to keep them.');
  };

  const showIssues = () => {
    setShowAll(true);
    focusSoon(() => document.querySelector<HTMLElement>(`${editorRoot} [aria-invalid="true"], ${editorRoot} [data-issue-anchor]`));
  };

  const save = useMutation({
    mutationFn: (v: { body: GameQuestions; sent: string; basedOn: string }) => gameApi.questions(game._id, v.body, v.basedOn),
    onSuccess: (g, v) => {
      const next = questionsOf(g.content);
      baseline.current = JSON.stringify(next);
      basedFp.current = questionsFingerprint(g.content);
      setConflict(false);
      // Edits made while the save was on its way stay in the draft.
      if (JSON.stringify(stateRef.current.q) === v.sent) {
        setState(stateFor(next));
        resetMarks();
        headingRef.current?.focus({ preventScroll: true });
      }
      clearStash(game._id);
      setStash(null);
      qc.setQueryData(gameKeys.game(game._id), g);
      void qc.invalidateQueries({ queryKey: gameKeys.games });
      toast.success('Questions saved');
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) {
        if (e.code === 'questions_changed') {
          // Keep the draft; the admin chooses whose version wins.
          setConflict(true);
          writeStash(game._id, stateRef.current.q);
        } else {
          // game_started: the lock follows from the refetch, which stashes the draft; stash it now in case that fails.
          writeStash(game._id, stateRef.current.q);
          toast.error(errorMessage(e));
        }
        void qc.invalidateQueries({ queryKey: gameKeys.game(game._id) });
        return;
      }
      toast.error(errorMessage(e));
    },
  });

  const onSave = () => {
    const parsed = gameQuestionsSchema.safeParse(state.q);
    if (!parsed.success) return showIssues();
    save.mutate({ body: parsed.data, sent: draftJson, basedOn: basedFp.current });
  };

  /** The newest saved game, straight from the server (the cache may be a few seconds behind). */
  const fetchLatest = async () => {
    const g = await gameApi.get(game._id);
    return g;
  };

  const loadTheirs = async () => {
    try {
      const g = await fetchLatest();
      const next = questionsOf(g.content);
      baseline.current = JSON.stringify(next);
      basedFp.current = questionsFingerprint(g.content);
      clearStash(game._id);
      setStash(null);
      setConflict(false);
      dismissUndos();
      setState(stateFor(next));
      resetMarks();
      qc.setQueryData(gameKeys.game(game._id), g);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const keepMine = async () => {
    try {
      const g = await fetchLatest();
      baseline.current = JSON.stringify(questionsOf(g.content));
      basedFp.current = questionsFingerprint(g.content);
      qc.setQueryData(gameKeys.game(game._id), g);
      if (g.status !== 'setup') return; // locked now: the draft is stashed for later
      setConflict(false);
      const parsed = gameQuestionsSchema.safeParse(stateRef.current.q);
      if (!parsed.success) return showIssues();
      save.mutate({ body: parsed.data, sent: JSON.stringify(stateRef.current.q), basedOn: basedFp.current });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const restoreStash = () => {
    if (!stash) return;
    dismissUndos();
    setState(stateFor(stash));
    resetMarks();
    setStash(null);
  };

  const dropStash = () => {
    clearStash(game._id);
    setStash(null);
  };

  /* ---------------- leaving with unsaved changes ---------------- */

  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Keep focused fields clear of the sticky app bar and the save bar.
  useEffect(() => {
    const html = document.documentElement;
    html.style.scrollPaddingTop = '80px';
    html.style.scrollPaddingBottom = dirty ? '96px' : '';
    return () => {
      html.style.scrollPaddingTop = '';
      html.style.scrollPaddingBottom = '';
    };
  }, [dirty]);

  /* ---------------- render ---------------- */

  const q = locked ? saved : state.q;

  const api: EditorApi = {
    q,
    content: game.content,
    teams: game.teams,
    locked,
    edit,
    issue: (path) => {
      const i = issues.get(path);
      if (!i) return undefined;
      return !i.quiet || showAll || touched.has(path) ? i.message : undefined;
    },
    touch,
    add,
    move,
    remove,
  };

  return (
    <EditorContext.Provider value={api}>
      <div data-q-editor="">
        <EditorHeader game={game} q={q} locked={locked} headingRef={headingRef} onLoadStandard={loadStandard} />
        <main className="mx-auto grid max-w-[800px] grid-cols-[minmax(0,1fr)] gap-10 px-4 pt-6 pb-16 sm:px-6">
          {locked || refreshError || conflict || (stash && !dirty) ? (
            <div className="grid gap-3">
              {locked ? (
                <MessageBar
                  intent="warning"
                  action={
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/admin/games/${game._id}`}>Open host console</Link>
                    </Button>
                  }
                >
                  {game.status === 'finished'
                    ? 'Questions are locked once a game has been played. Reset the game from the host console to edit them.'
                    : 'Questions are locked while the game is running. Reset the game from the host console to edit them.'}
                </MessageBar>
              ) : null}
              {!locked && conflict ? (
                <MessageBar
                  intent="warning"
                  action={
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => void loadTheirs()}>
                        Load their version
                      </Button>
                      <Button size="sm" variant="outline" disabled={save.isPending} onClick={() => void keepMine()}>
                        Keep mine and save over theirs
                      </Button>
                    </div>
                  }
                >
                  Someone saved these questions in another window.
                </MessageBar>
              ) : null}
              {!locked && stash && !dirty ? (
                <MessageBar
                  intent="info"
                  action={
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={restoreStash}>
                        Restore them
                      </Button>
                      <Button size="sm" variant="outline" onClick={dropStash}>
                        Discard
                      </Button>
                    </div>
                  }
                >
                  You have unsaved edits from earlier.
                </MessageBar>
              ) : null}
              {refreshError ? <MessageBar intent="warning">Could not refresh the game: {errorMessage(refreshError)}</MessageBar> : null}
            </div>
          ) : null}
          <Round1 />
          <Round2 />
          <Round3 />
          <Round4 />
          <Tiebreak />
        </main>
        {dirty ? <SaveBar problems={problems} saving={save.isPending} onSave={onSave} onDiscard={discard} onShow={showIssues} /> : null}
        <LeaveGuard blocker={blocker} />
      </div>
    </EditorContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* Header band                                                          */
/* ------------------------------------------------------------------ */

function EditorHeader({
  game,
  q,
  locked,
  headingRef,
  onLoadStandard,
}: {
  game: AdminGame;
  q: GameQuestions;
  locked: boolean;
  headingRef: React.Ref<HTMLHeadingElement>;
  onLoadStandard: () => void;
}) {
  const max = maxOf(game.content, q);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="border-b border-line bg-surface">
      <div className="mx-auto max-w-[1120px] px-4 py-4 sm:px-8">
        <Link to={`/admin/games/${game._id}`} className="inline-flex items-center gap-1.5 rounded-sm text-[13px] font-semibold text-brand hover:underline">
          <ArrowLeft className="size-3.5" aria-hidden /> Back to the game
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="min-w-0 flex-1 basis-full sm:basis-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 ref={headingRef} tabIndex={-1} className="min-w-0 text-xl leading-7 font-semibold break-words text-ink outline-none">
                Questions · {game.title}
              </h1>
              <GameStatusBadge status={game.status} />
            </div>
            <p className="mt-1 text-sm leading-5 text-ink-3">
              Maximum score: <span className="font-semibold text-ink tabular-nums">{num(max.total)}</span> points per team
              <span className="hidden md:inline">
                {' '}
                · Round 1: {num(max.r1)} · Round 2: {num(max.r2)} · Round 3: {num(max.r3)} · Round 4: {num(max.r4)}
              </span>
            </p>
          </div>
          {!locked ? (
            <Button variant="outline" onClick={() => setConfirm(true)}>
              <ListRestart /> Load the standard questions
            </Button>
          ) : null}
        </div>
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Load the standard questions?</AlertDialogTitle>
            <AlertDialogDescription>Replaces every question in this game with the standard Cyber Survivor set. Nothing is saved until you press Save.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onLoadStandard}>Load the standard questions</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Save bar and leave guard                                             */
/* ------------------------------------------------------------------ */

function SaveBar({ problems, saving, onSave, onDiscard, onShow }: { problems: number; saving: boolean; onSave: () => void; onDiscard: () => void; onShow: () => void }) {
  // Buttons first: on the right they would sit under the Undo toasts.
  return (
    <div className="sticky bottom-0 z-30 border-t border-line bg-surface shadow-[0_-4px_12px_rgb(0_0_0/0.06)]">
      <div className="mx-auto flex max-w-[800px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
        <div role="status" className="flex min-h-11 basis-full items-center gap-2 text-sm leading-5 sm:order-last sm:ml-auto sm:basis-auto">
          {problems ? (
            <>
              <TriangleAlert className="size-4 shrink-0 text-warn" aria-hidden />
              <span className="font-semibold text-ink">{problems === 1 ? '1 thing needs attention' : `${problems} things need attention`}</span>
              <button
                type="button"
                onClick={onShow}
                className="inline-flex h-11 items-center rounded-sm px-1.5 font-semibold text-brand outline-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                Show me
              </button>
            </>
          ) : (
            <span className="font-semibold text-ink">You have unsaved changes</span>
          )}
        </div>
        <Button size="lg" onClick={onSave} disabled={saving || problems > 0}>
          {saving ? <Loader2 className="animate-spin" /> : null}
          Save changes
        </Button>
        <Button size="lg" variant="outline" onClick={onDiscard} disabled={saving}>
          Discard changes
        </Button>
      </div>
    </div>
  );
}

function LeaveGuard({ blocker }: { blocker: Blocker }) {
  return (
    <AlertDialog open={blocker.state === 'blocked'} onOpenChange={(open) => !open && blocker.state === 'blocked' && blocker.reset()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
          <AlertDialogDescription>Your changes to the questions have not been saved. If you leave now, they are lost.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Stay</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={(e) => {
              // Keep the dialog from closing itself: closing would reset the blocker before it proceeds.
              e.preventDefault();
              if (blocker.state === 'blocked') blocker.proceed();
            }}
          >
            Leave without saving
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
