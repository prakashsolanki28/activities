import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { questionCode, type AdminActivity } from '@hrrl/shared';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { QuestionPreview } from './preview';

/** Walk through every question as an employee would see it, without publishing. */
export function PreviewDialog({ activity, open, onOpenChange, startAt }: { activity: AdminActivity; open: boolean; onOpenChange: (o: boolean) => void; startAt?: string | null }) {
  const items = activity.sections.flatMap((section, si) =>
    section.questions.filter((q) => !q.archived).map((question, qi) => ({ section, si, question, code: questionCode(si, qi) })),
  );
  const startIndex = Math.max(0, items.findIndex((i) => i.question.id === startAt));
  const [pos, setPos] = useState(startIndex);
  const item = items[Math.min(pos, items.length - 1)];
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setPos(startIndex);
        onOpenChange(o);
      }}
    >
      <DialogContent className="flex max-h-[92dvh] w-[96vw] max-w-[1100px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1100px]">
        <div className="flex items-center gap-3 border-b border-line px-5 py-3">
          <DialogTitle className="text-base font-semibold text-ink">Preview</DialogTitle>
          <DialogDescription className="text-sm text-ink-3">What employees see. Answers here are not saved.</DialogDescription>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-ground p-5">
          {item ? (
            <div className="mx-auto max-w-[760px]">
              <QuestionPreview key={item.question.id} question={item.question} section={item.section} sectionIndex={item.si} code={item.code} />
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-ink-3">Add a question to preview it.</p>
          )}
        </div>
        {items.length ? (
          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
            <Button variant="outline" onClick={() => setPos((p) => Math.max(0, p - 1))} disabled={pos === 0}>
              <ChevronLeft /> Previous
            </Button>
            <span className="text-sm text-ink-3 tabular-nums">
              Question {pos + 1} of {items.length}
            </span>
            <Button onClick={() => setPos((p) => Math.min(items.length - 1, p + 1))} disabled={pos >= items.length - 1}>
              Next <ChevronRight />
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
