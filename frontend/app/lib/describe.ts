import type { AnswerValue, PublicQuestion } from '@hrrl/shared';

/** Option labels may carry markdown (`code`, **bold**); plain text strips it. */
export const plain = (s: string) => s.replace(/[*_`]/g, '').trim();

/** The employee's answer in words, for review lists. */
export function describeValue(q: PublicQuestion, value: AnswerValue | undefined | null): string {
  if (value === undefined || value === null || value === '') return '';
  switch (q.type) {
    case 'single':
      return plain(q.options?.find((o) => o.id === value)?.label ?? '');
    case 'multi':
      return (Array.isArray(value) ? value : [])
        .map((id) => plain(q.options?.find((o) => o.id === id)?.label ?? ''))
        .filter(Boolean)
        .join(' · ');
    case 'boolean':
      return value === true ? (q.trueLabel ?? 'Yes') : value === false ? (q.falseLabel ?? 'No') : '';
    case 'list_text':
      return (Array.isArray(value) ? value : []).filter((v) => v.trim()).join(' · ');
    case 'ordering':
      return (Array.isArray(value) ? value : []).map((id) => q.orderItems?.find((i) => i.id === id)?.label ?? '').join(' → ');
    case 'hotspot':
      return 'Marked a spot on the evidence';
    case 'spot_flags':
      return typeof value === 'object' && !Array.isArray(value) && 'marks' in value ? `Drew ${value.marks.length} ${value.marks.length === 1 ? 'box' : 'boxes'}` : '';
    case 'number':
      return `${value}${q.unit ? ` ${q.unit}` : ''}`;
    default:
      return String(value);
  }
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}
