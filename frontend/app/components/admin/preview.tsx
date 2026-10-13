import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { clampSpotBox, judgeSpotMark, replaySpot, type AnswerValue, type PublicQuestion, type Question, type Reveal, type Section, type SpotBox, type SpotState } from '@hrrl/shared';
import { SpotPanel, type SpotNote } from '~/components/play/spot-panel';
import { Button } from '~/components/ui/button';
import { EvidenceLog, EvidencePlate } from '~/components/evidence/plate';
import { CodeChip, ExhibitTag } from '~/components/evidence/tags';
import { Prompt } from '~/components/evidence/prompt';
import { AnswerInput } from '~/components/play/answer-input';
import { LearningPoint, NextClue } from '~/components/play/reveal-panel';

/** Same shape the server sends employees, built from the draft so the preview is honest. */
function toPublic(q: Question, sectionId: string, code: string): PublicQuestion {
  return {
    id: q.id,
    code,
    sectionId,
    type: q.type,
    prompt: q.prompt,
    image: q.image ?? null,
    points: q.points,
    bonus: q.bonus,
    required: q.required,
    maxTries: q.maxTries,
    options: q.options.map((o) => ({ id: o.id, label: o.label, image: o.image ?? null })),
    trueLabel: q.trueLabel,
    falseLabel: q.falseLabel,
    inputCount: q.inputCount,
    unit: q.unit,
    orderItems: q.orderItems,
    scaleMax: q.scaleMax,
    minLabel: q.minLabel,
    maxLabel: q.maxLabel,
    flagCount: q.regions.length,
    maxMisses: q.maxMisses,
  };
}

function previewReveal(q: Question): Reveal {
  return {
    questionId: q.id,
    isCorrect: null,
    points: 0,
    maxPoints: q.points,
    needsReview: false,
    correct: {
      foundIndexes: q.type === 'spot_flags' ? [] : undefined,
      optionIds: q.options.filter((o) => o.correct).map((o) => o.id),
      boolean: q.correctBoolean ?? undefined,
      order: q.orderItems,
      regions: q.regions,
    },
    explanation: q.explanation,
    revealText: q.revealText,
    highlights: q.highlights,
  };
}

export function QuestionPreview({ question, section, sectionIndex, code }: { question: Question; section: Section; sectionIndex: number; code: string }) {
  const [value, setValue] = useState<AnswerValue | undefined>(undefined);
  const [revealed, setRevealed] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [marks, setMarks] = useState<SpotBox[]>([]);
  const [note, setNote] = useState<SpotNote>(null);
  useEffect(() => {
    setValue(undefined);
    setRevealed(false);
    setMarks([]);
    setNote(null);
  }, [question.id, question.type]);

  const pub = toPublic(question, section.id, code);
  const evidence = question.image ?? section.image ?? null;
  const isSpot = question.type === 'spot_flags';
  // The preview judges boxes locally with the same rule the server uses.
  const aspect = evidence ? evidence.h / evidence.w : 1;
  const replay = replaySpot(question.regions, marks, aspect);
  const spotLocked = revealed || replay.found.size === question.regions.length || (question.maxMisses > 0 && replay.misses >= question.maxMisses);
  const spot: SpotState = {
    total: question.regions.length,
    maxMisses: question.maxMisses,
    misses: replay.misses,
    found: [...replay.found].sort((a, b) => a - b).map((index) => ({ index, region: question.regions[index] })),
    missMarks: marks.filter((_, i) => replay.outcomes[i]?.kind === 'miss'),
    locked: spotLocked,
    silent: false,
    drawn: [],
    maxMarks: 0,
  };
  const baseReveal = revealed || (isSpot && spotLocked) ? previewReveal(question) : null;
  const reveal = baseReveal && isSpot ? { ...baseReveal, highlights: question.regions, correct: { ...baseReveal.correct!, regions: question.regions, foundIndexes: [...replay.found] } } : baseReveal;
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="xs" onClick={() => setRevealed((r) => !r)}>
          {revealed ? <EyeOff /> : <Eye />}
          {revealed ? 'Hide answers' : 'Show answers'}
        </Button>
      </div>
      <div className="evidence-ui grid gap-4 rounded-md bg-ground p-4 ring-1 ring-line">
        <ExhibitTag index={sectionIndex} title={section.title || undefined} className="max-w-full justify-self-start" />
        {evidence && isSpot ? (
          <EvidencePlate
            image={evidence}
            highlights={reveal ? question.regions : spot.found.map((f) => f.region)}
            revealed={!!reveal || spot.found.length > 0}
            regionNumber={reveal ? undefined : (_r, i) => spot.found[i].index + 1}
            regionTone={reveal ? (_r, i) => (replay.found.has(i) ? 'correct' : 'missed') : undefined}
            missMarks={spot.missMarks}
            onMark={
              spotLocked
                ? undefined
                : (b) => {
                    const box = clampSpotBox(b);
                    const o = judgeSpotMark(box, question.regions, replay.found, aspect);
                    if (o.kind === 'hit') setNote({ kind: 'hit', label: question.regions[o.index].label, n: o.index + 1 });
                    else if (o.kind === 'repeat') setNote({ kind: 'repeat', n: o.index + 1 });
                    else setNote({ kind: 'miss', left: question.maxMisses > 0 ? Math.max(0, question.maxMisses - replay.misses - 1) : null });
                    // Repeats are not stored, exactly as on the server.
                    if (o.kind !== 'repeat') setMarks((m) => [...m, box]);
                  }
            }
          />
        ) : evidence ? (
          <EvidencePlate
            image={evidence}
            highlights={question.highlights}
            revealed={revealed}
            answerRegions={question.type === 'hotspot' ? question.regions : undefined}
            point={question.type === 'hotspot' && value && typeof value === 'object' && !Array.isArray(value) && 'x' in value ? value : null}
            onPoint={question.type === 'hotspot' ? (p) => setValue(p) : undefined}
            activeId={active}
            onActiveChange={setActive}
          />
        ) : null}
        <div>
          <Prompt text={question.prompt || '_Question text_'} className="text-base leading-6 font-semibold" />
          <CodeChip className="mt-2">{code}</CodeChip>
        </div>
        {isSpot ? (
          <SpotPanel spot={spot} reveal={reveal} note={note} onDone={() => setRevealed(true)} />
        ) : (
          <AnswerInput question={pub} value={value} onChange={setValue} locked={revealed} reveal={reveal} labelledBy="" />
        )}
        {isSpot && marks.length ? (
          <button type="button" className="justify-self-start text-xs font-semibold text-slate underline underline-offset-4" onClick={() => {
              setMarks([]);
              setRevealed(false);
              setNote(null);
            }}>
            Reset preview
          </button>
        ) : null}
        {reveal ? (
          <div className="grid gap-3">
            {reveal.highlights.length && !isSpot ? <EvidenceLog regions={reveal.highlights} activeId={active} onActiveChange={setActive} /> : null}
            <LearningPoint text={reveal.explanation} />
            {question.revealText ? <NextClue text={question.revealText} /> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
