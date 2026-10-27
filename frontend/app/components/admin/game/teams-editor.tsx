import { useId, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { GAME_MAX_TEAMS, GAME_MIN_TEAMS, type Team } from '@hrrl/shared';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { ErrorNote } from '~/components/admin/ui';
import { errorMessage } from '~/lib/api';
import { newId } from '~/lib/ids';
import { cn } from '~/lib/utils';

const NAME_MAX = 40;
const EMOJI_MAX = 16;
const EMOJI_IDEAS = ['⚡', '🦉', '🐯', '🚀', '🧩', '🌟'];

export interface TeamsCheck {
  /** Problem with one team, by team id. */
  rows: Record<string, string>;
  /** Problem with the list as a whole. */
  list?: string;
  ok: boolean;
}

/** The same rules the API applies, phrased for the row they belong to. */
export function checkTeams(teams: Team[]): TeamsCheck {
  const rows: Record<string, string> = {};
  const seen = new Map<string, string>();
  for (const t of teams) {
    const name = t.name.trim();
    if (!name) rows[t.id] = 'Give the team a name';
    else if (name.length > NAME_MAX) rows[t.id] = `Up to ${NAME_MAX} characters`;
    else {
      const k = name.toLowerCase();
      if (seen.has(k)) rows[t.id] = 'Another team already has this name';
      else seen.set(k, t.id);
    }
  }
  const list =
    teams.length < GAME_MIN_TEAMS ? `Add at least ${GAME_MIN_TEAMS} teams` : teams.length > GAME_MAX_TEAMS ? `Up to ${GAME_MAX_TEAMS} teams` : undefined;
  return { rows, list, ok: !list && Object.keys(rows).length === 0 };
}

export const cleanTeams = (teams: Team[]): Team[] => teams.map((t) => ({ id: t.id, name: t.name.trim(), emoji: t.emoji.trim() }));

export const sameTeams = (a: Team[], b: Team[]) =>
  a.length === b.length && a.every((t, i) => t.id === b[i]!.id && t.name.trim() === b[i]!.name && t.emoji.trim() === b[i]!.emoji);

/** Name and emoji for each team; add or remove within the allowed range. */
export function TeamsEditor({
  teams,
  onChange,
  disabled,
  showErrors = true,
}: {
  teams: Team[];
  onChange: (teams: Team[]) => void;
  disabled?: boolean;
  showErrors?: boolean;
}) {
  const uid = useId();
  const check = checkTeams(teams);
  const patch = (id: string, p: Partial<Team>) => onChange(teams.map((t) => (t.id === id ? { ...t, ...p } : t)));
  const add = () => {
    const used = new Set(teams.map((t) => t.emoji));
    const names = new Set(teams.map((t) => t.name.trim().toLowerCase()));
    let n = teams.length + 1;
    while (names.has(`team ${n}`)) n++;
    onChange([...teams, { id: newId(), name: `Team ${n}`, emoji: EMOJI_IDEAS.find((e) => !used.has(e)) ?? '' }]);
  };
  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-[64px_minmax(0,1fr)_44px] gap-x-2 px-0.5 text-[13px] font-semibold text-ink" aria-hidden>
        <span>Emoji</span>
        <span>Team name</span>
      </div>
      <ul className="grid gap-2">
        {teams.map((t, i) => {
          const err = showErrors ? check.rows[t.id] : undefined;
          const errId = `${uid}-${t.id}-err`;
          return (
            <li key={t.id} className="grid grid-cols-[64px_minmax(0,1fr)_44px] items-start gap-x-2">
              <Input
                value={t.emoji}
                onChange={(e) => patch(t.id, { emoji: e.target.value })}
                maxLength={EMOJI_MAX}
                aria-label={`Emoji for team ${i + 1}`}
                className="h-11 text-center text-lg"
                disabled={disabled}
              />
              <div className="min-w-0">
                <Input
                  value={t.name}
                  onChange={(e) => patch(t.id, { name: e.target.value })}
                  maxLength={NAME_MAX}
                  aria-label={`Name of team ${i + 1}`}
                  aria-invalid={err ? true : undefined}
                  aria-describedby={err ? errId : undefined}
                  className="h-11"
                  disabled={disabled}
                />
                {err ? (
                  <p id={errId} className="mt-1 text-xs leading-5 font-semibold text-red-ink">
                    {err}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                onClick={() => onChange(teams.filter((x) => x.id !== t.id))}
                disabled={disabled || teams.length <= GAME_MIN_TEAMS}
                aria-label={`Remove ${t.name.trim() || `team ${i + 1}`}`}
              >
                <X />
              </Button>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button type="button" variant="outline" onClick={add} disabled={disabled || teams.length >= GAME_MAX_TEAMS}>
          <Plus /> Add team
        </Button>
        <span className="text-xs text-ink-3">
          {GAME_MIN_TEAMS} to {GAME_MAX_TEAMS} teams
        </span>
      </div>
      {showErrors && check.list ? <p className="text-xs leading-5 font-semibold text-red-ink">{check.list}</p> : null}
    </div>
  );
}

/** A teams editor with its own draft and a Save button, for an existing game. */
export function TeamsForm({
  initial,
  onSave,
  onCancel,
  saveLabel = 'Save teams',
  note,
  className,
}: {
  initial: Team[];
  onSave: (teams: Team[]) => Promise<void>;
  onCancel?: () => void;
  saveLabel?: string;
  note?: React.ReactNode;
  className?: string;
}) {
  const [draft, setDraft] = useState<Team[]>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const check = checkTeams(draft);
  const dirty = !sameTeams(draft, initial);
  const submit = async () => {
    if (!check.ok || !dirty) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(cleanTeams(draft));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <form
      className={cn('grid gap-3', className)}
      // The host console will not change stage while this is set, so a draft is never lost.
      data-unsaved-teams={dirty || undefined}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <TeamsEditor teams={draft} onChange={setDraft} disabled={saving} />
      {note}
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        ) : dirty ? (
          <Button type="button" variant="ghost" onClick={() => setDraft(initial)} disabled={saving}>
            Undo changes
          </Button>
        ) : null}
        <Button type="submit" disabled={!dirty || !check.ok || saving}>
          {saving ? <Loader2 className="animate-spin" /> : null}
          {saveLabel}
        </Button>
      </div>
    </form>
  );
}
