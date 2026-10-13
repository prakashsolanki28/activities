import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import { cn } from '~/lib/utils';

const ALLOWED = ['p', 'strong', 'em', 'code', 'blockquote', 'ul', 'ol', 'li', 'br'];

/**
 * Question prompts support a small markdown subset: **bold**, `code` for addresses and URLs,
 * > quoted messages, lists and line breaks. No links, images or HTML.
 */
export function Prompt({ text, className, size = 'md' }: { text: string; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div
      className={cn(
        'text-ink [&_p]:my-0 [&_p+p]:mt-3 [&_strong]:font-bold',
        '[&_code]:rounded-xs [&_code]:bg-ground-2 [&_code]:px-1 [&_code]:py-px [&_code]:font-mono [&_code]:text-[0.9em] [&_code]:break-all',
        '[&_blockquote]:my-3 [&_blockquote]:rounded-xs [&_blockquote]:border [&_blockquote]:border-line-strong [&_blockquote]:bg-surface [&_blockquote]:px-4 [&_blockquote]:py-3 [&_blockquote]:font-medium [&_blockquote]:text-ink',
        '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
        size === 'sm' && 'text-sm leading-6',
        size === 'md' && 'text-[17px] leading-7',
        size === 'lg' && 'text-xl leading-8 font-semibold',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkBreaks]} allowedElements={ALLOWED} unwrapDisallowed skipHtml>
        {text}
      </ReactMarkdown>
    </div>
  );
}

/** Plain-text version for tables and outlines. */
export function promptText(text: string): string {
  return text
    .replace(/[*_`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
