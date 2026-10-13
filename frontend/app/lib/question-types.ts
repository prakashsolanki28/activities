import { AlignLeft, ArrowDownUp, CircleDot, Crosshair, Gauge, Hash, ListChecks, ListOrdered, ScanSearch, TextCursorInput, ToggleLeft, type LucideIcon } from 'lucide-react';
import { questionSchema, type Question, type QuestionType } from '@hrrl/shared';
import { newId } from './ids';

export const TYPE_META: Record<QuestionType, { label: string; icon: LucideIcon; hint: string }> = {
  single: { label: 'Single choice', icon: CircleDot, hint: 'One correct option' },
  multi: { label: 'Multiple choice', icon: ListChecks, hint: 'Select all that apply' },
  boolean: { label: 'Yes / No', icon: ToggleLeft, hint: 'Two big buttons' },
  short_text: { label: 'Short answer', icon: TextCursorInput, hint: 'Riddles, codes, one word' },
  list_text: { label: 'List of answers', icon: ListOrdered, hint: 'Name N red flags' },
  long_text: { label: 'Written answer', icon: AlignLeft, hint: 'Reviewed by hand or unscored' },
  number: { label: 'Number', icon: Hash, hint: 'With tolerance' },
  ordering: { label: 'Put in order', icon: ArrowDownUp, hint: 'Drag steps into sequence' },
  hotspot: { label: 'Spot on the image', icon: Crosshair, hint: 'Tap the suspicious part' },
  rating: { label: 'Rating scale', icon: Gauge, hint: 'Feedback, not scored' },
  spot_flags: { label: 'Spot the red flags', icon: ScanSearch, hint: 'Box every red flag on a screenshot' },
};

export const TYPE_ORDER: QuestionType[] = ['spot_flags', 'single', 'multi', 'boolean', 'short_text', 'list_text', 'hotspot', 'ordering', 'number', 'long_text', 'rating'];

/** Fill in what a type needs so switching types never leaves an unusable question. */
export function withTypeDefaults(q: Question, type: QuestionType): Question {
  const next: Question = { ...q, type };
  if ((type === 'single' || type === 'multi') && next.options.length < 2) {
    next.options = [...next.options, ...Array.from({ length: 4 - next.options.length }, () => ({ id: newId(), label: '', image: null, correct: false }))];
  }
  if (type === 'single' && next.options.filter((o) => o.correct).length > 1) {
    let seen = false;
    next.options = next.options.map((o) => {
      const keep = o.correct && !seen;
      if (o.correct) seen = true;
      return { ...o, correct: keep };
    });
  }
  if (type === 'ordering' && next.orderItems.length < 2) {
    next.orderItems = [
      { id: newId(), label: 'Stop' },
      { id: newId(), label: 'Think' },
      { id: newId(), label: 'Verify' },
      { id: newId(), label: 'Report' },
    ];
  }
  if (type === 'spot_flags' && !next.regions.length && next.highlights.length) {
    // Red flags already marked for this question become the flags to find.
    next.regions = next.highlights.map((r) => ({ ...r, id: newId() }));
    next.points = Math.max(next.points, next.regions.length);
  }
  if (type === 'list_text' && !next.keywordGroups.length) {
    next.keywordGroups = [{ id: newId(), label: '', keywords: [] }];
  }
  return next;
}

export function newQuestion(type: QuestionType): Question {
  return withTypeDefaults(questionSchema.parse({ id: newId(), type, prompt: '' }), type);
}
