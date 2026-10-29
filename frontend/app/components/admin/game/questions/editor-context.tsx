import { createContext, useContext } from 'react';
import type { GameContent, GameQuestions, Team } from '@hrrl/shared';
import type { ListName } from './model';

export interface QuestionsEditor {
  /** What the editor shows: the draft, or the saved questions while the game is locked. */
  q: GameQuestions;
  content: GameContent;
  teams: Team[];
  locked: boolean;
  /** Change fields on a copy of the draft. */
  edit: (fn: (q: GameQuestions) => void) => void;
  /** The message to show at a field, by dotted path (e.g. "r1.challenges.2.situation"). */
  issue: (path: string) => string | undefined;
  /** The admin has left a field: its empty-field message may now show. */
  touch: (path: string) => void;
  add: (list: ListName) => void;
  move: (list: ListName, index: number, by: -1 | 1) => void;
  remove: (list: ListName, index: number) => void;
}

export const EditorContext = createContext<QuestionsEditor | null>(null);

export function useEditor(): QuestionsEditor {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor must be used inside the question editor');
  return ctx;
}
