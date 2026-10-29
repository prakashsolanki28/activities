import { MessageBar } from '~/components/admin/ui';
import { cn } from '~/lib/utils';
import { useEditor } from './editor-context';
import { CardChoiceField, ErrorText, LinesField, NumberField, PromptField, TextField } from './fields';
import { AddItem, ItemCard, ItemList, ListIssue, RoundSection } from './item-card';
import { count, maxOf, num } from './model';

/* ------------------------------------------------------------------ */
/* Round 1: situations answered with a card                             */
/* ------------------------------------------------------------------ */

export function Round1() {
  const { q, content, edit } = useEditor();
  const items = q.r1.challenges;
  const max = maxOf(content, q);
  return (
    <RoundSection
      id="round-1"
      eyebrow="Round 1 · Situations"
      srTitlePrefix="Round 1:"
      title={content.r1.title}
      summary={`${count(items.length, 'situation')} · ${num(q.r1.pointsEach)} points each · ${num(max.r1)} points`}
      header={
        <NumberField
          path="r1.pointsEach"
          label="Points for each correct answer"
          min={1}
          max={50}
          value={q.r1.pointsEach}
          onChange={(v) =>
            edit((d) => {
              d.r1.pointsEach = v;
            })
          }
        />
      }
    >
      <ItemList list="r1">
        {items.map((c, i) => (
          <ItemCard key={c.id} list="r1" index={i} total={items.length}>
            {({ headingId }) => (
              <>
                <PromptField
                  path={`r1.challenges.${i}.situation`}
                  labelledBy={headingId}
                  focusKey={c.id}
                  maxLength={240}
                  placeholder="What happens? e.g. A caller says they are from IT and asks for your OTP."
                  value={c.situation}
                  onChange={(v) =>
                    edit((d) => {
                      d.r1.challenges[i].situation = v;
                    })
                  }
                />
                <CardChoiceField
                  label="Correct card"
                  srSuffix={`for situation ${i + 1}`}
                  value={c.answer}
                  onChange={(v) =>
                    edit((d) => {
                      d.r1.challenges[i].answer = v;
                    })
                  }
                />
                <TextField
                  multiline
                  optional
                  path={`r1.challenges.${i}.explanation`}
                  label="Explanation"
                  srSuffix={`for situation ${i + 1}`}
                  hint="Shown on the projector after you press Reveal."
                  maxLength={300}
                  value={c.explanation}
                  onChange={(v) =>
                    edit((d) => {
                      d.r1.challenges[i].explanation = v;
                    })
                  }
                />
              </>
            )}
          </ItemCard>
        ))}
      </ItemList>
      <ListIssue list="r1" />
      <AddItem list="r1" label="Add situation" />
    </RoundSection>
  );
}

/* ------------------------------------------------------------------ */
/* Round 2: played offline; only the most marks a team can get          */
/* ------------------------------------------------------------------ */

export function Round2() {
  const { q, content, edit } = useEditor();
  const max = maxOf(content, q);
  return (
    <RoundSection
      id="round-2"
      eyebrow="Round 2 · Offline"
      srTitlePrefix="Round 2:"
      title={content.r2.title}
      summary={`Host gives marks · up to ${num(max.r2)} points per team`}
      header={
        <>
          <NumberField
            path="r2.maxMarks"
            label="Maximum marks per team"
            min={1}
            max={100}
            value={q.r2.maxMarks}
            onChange={(v) =>
              edit((d) => {
                d.r2.maxMarks = v;
              })
            }
          />
          <p className="text-sm leading-5 text-ink-2">
            This round has no questions to set up. Teams act out cyber threats without words, and the host types each team’s marks during the game.
          </p>
        </>
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/* Round 3: the auction                                                 */
/* ------------------------------------------------------------------ */

function PointsTag({ points }: { points: number }) {
  if (!Number.isFinite(points)) return null;
  const [text, tone] = points > 0 ? ['Good action', 'text-ok'] : points < 0 ? ['Harmful action', 'text-bad'] : ['No points', 'text-ink-3'];
  return <span className={cn('text-[13px] font-semibold', tone)}>{text}</span>;
}

export function Round3() {
  const { q, content, edit, issue } = useEditor();
  const actions = q.r3.actions;
  const budget = q.r3.budget;
  const max = maxOf(content, q);
  const allCost = actions.reduce((n, a) => n + a.cost, 0);
  const fitsAll = Number.isFinite(allCost) && Number.isFinite(budget) && allCost <= budget;
  const listError = issue('r3.actions');
  return (
    <RoundSection
      id="round-3"
      eyebrow="Round 3 · Auction"
      srTitlePrefix="Round 3:"
      title={content.r3.title}
      summary={`${count(actions.length, 'action')} · ${num(budget)} Cyber Coins · up to ${num(max.r3)} points`}
      header={
        <>
          <NumberField
            path="r3.budget"
            label="Budget (Cyber Coins)"
            min={1}
            max={1000}
            value={budget}
            onChange={(v) =>
              edit((d) => {
                d.r3.budget = v;
              })
            }
          />
          <div className="grid gap-1 text-sm leading-5 text-ink-2">
            <p>
              All actions cost <span className="font-semibold text-ink tabular-nums">{num(allCost)}</span> coins; the budget is{' '}
              <span className="font-semibold text-ink tabular-nums">{num(budget)}</span>.
            </p>
            <p>
              Maximum: <span className="font-semibold text-ink tabular-nums">{num(max.r3)} points</span>, the total of the actions that earn points. A team’s score for
              the round stays between 0 and {num(max.r3)}.
            </p>
          </div>
          {fitsAll ? (
            <MessageBar intent="warning">
              Every action fits in the budget, so teams can buy everything and there is nothing to choose. Raise some costs or lower the budget.
            </MessageBar>
          ) : null}
          <TextField
            multiline
            optional
            path="r3.lesson"
            label="Lesson shown with the auction results"
            maxLength={300}
            placeholder="e.g. Reporting early costs little and protects everyone."
            hint="Shown on the projector with the Round 3 results."
            value={q.r3.lesson}
            onChange={(v) =>
              edit((d) => {
                d.r3.lesson = v;
              })
            }
          />
          {listError ? <ErrorText anchor>{listError}</ErrorText> : null}
        </>
      }
    >
      <ItemList list="r3">
        {actions.map((a, i) => (
          <ItemCard key={a.id} list="r3" index={i} total={actions.length}>
            {({ headingId }) => (
              <>
                <PromptField
                  path={`r3.actions.${i}.label`}
                  labelledBy={headingId}
                  focusKey={a.id}
                  maxLength={120}
                  placeholder="What teams can spend coins on, e.g. Report the incident"
                  value={a.label}
                  onChange={(v) =>
                    edit((d) => {
                      d.r3.actions[i].label = v;
                    })
                  }
                />
                <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
                  <NumberField
                    path={`r3.actions.${i}.cost`}
                    label="Cost (coins)"
                    srSuffix={`for action ${i + 1}`}
                    min={0}
                    max={1000}
                    value={a.cost}
                    onChange={(v) =>
                      edit((d) => {
                        d.r3.actions[i].cost = v;
                      })
                    }
                  />
                  <NumberField
                    allowNegative
                    className="min-w-0 flex-1 basis-44"
                    path={`r3.actions.${i}.points`}
                    label="Points"
                    srSuffix={`for action ${i + 1}`}
                    min={-50}
                    max={50}
                    hint="Positive for a good action, negative for a harmful one."
                    after={<PointsTag points={a.points} />}
                    value={a.points}
                    onChange={(v) =>
                      edit((d) => {
                        d.r3.actions[i].points = v;
                      })
                    }
                  />
                </div>
              </>
            )}
          </ItemCard>
        ))}
      </ItemList>
      <AddItem list="r3" label="Add action" />
    </RoundSection>
  );
}

/* ------------------------------------------------------------------ */
/* Round 4: the final mission                                           */
/* ------------------------------------------------------------------ */

export function Round4() {
  const { q, content, edit } = useEditor();
  const items = q.r4.situations;
  const max = maxOf(content, q);
  return (
    <RoundSection
      id="round-4"
      eyebrow="Round 4 · Situations"
      srTitlePrefix="Round 4:"
      title={content.r4.title}
      summary={`${count(items.length, 'situation')} · ${num(q.r4.pointsEach)} points each · ${num(max.r4)} points`}
      header={
        <NumberField
          path="r4.pointsEach"
          label="Points for each correct action"
          min={1}
          max={50}
          value={q.r4.pointsEach}
          onChange={(v) =>
            edit((d) => {
              d.r4.pointsEach = v;
            })
          }
        />
      }
    >
      <ItemList list="r4">
        {items.map((s, i) => (
          <ItemCard key={s.id} list="r4" index={i} total={items.length} srPrefix="Round 4">
            {({ headingId }) => (
              <>
                <PromptField
                  path={`r4.situations.${i}.text`}
                  labelledBy={headingId}
                  focusKey={s.id}
                  maxLength={200}
                  placeholder="What goes wrong? e.g. A colleague finds an unknown USB drive."
                  value={s.text}
                  onChange={(v) =>
                    edit((d) => {
                      d.r4.situations[i].text = v;
                    })
                  }
                />
                <TextField
                  multiline
                  path={`r4.situations.${i}.correctAction`}
                  label="Correct action"
                  srSuffix={`for round 4, situation ${i + 1}`}
                  maxLength={160}
                  placeholder="e.g. Do not connect the unknown USB drive"
                  hint="Shown on the projector with the mission results."
                  value={s.correctAction}
                  onChange={(v) =>
                    edit((d) => {
                      d.r4.situations[i].correctAction = v;
                    })
                  }
                />
              </>
            )}
          </ItemCard>
        ))}
      </ItemList>
      <ListIssue list="r4" />
      <AddItem list="r4" label="Add situation" />
    </RoundSection>
  );
}

/* ------------------------------------------------------------------ */
/* Tie-breaker                                                          */
/* ------------------------------------------------------------------ */

export function Tiebreak() {
  const { q, edit } = useEditor();
  const tb = q.tiebreak;
  return (
    <RoundSection
      id="tiebreak"
      eyebrow="Only if the top teams are level"
      title="Tie-breaker"
      summary={`One question · ${count(tb.expected.length, 'expected answer')} · no points; it only breaks the tie`}
      header={
        <>
          <TextField
            multiline
            path="tiebreak.question"
            label="Question"
            srSuffix="for the tie-breaker"
            maxLength={300}
            placeholder="e.g. You entered your password on a suspicious website. What are the first two things you should do?"
            value={tb.question}
            onChange={(v) =>
              edit((d) => {
                d.tiebreak.question = v;
              })
            }
          />
          <LinesField
            path="tiebreak.expected"
            legend="Expected answers"
            srSuffix="for the tie-breaker"
            itemLabel="Expected answer"
            hint="Shown on the projector after you press Reveal. The host picks the clearest, safest answer."
            min={1}
            max={4}
            maxLength={200}
            addLabel="Add an expected answer"
            minHint="Keep at least one expected answer"
            values={tb.expected}
            onChange={(v) =>
              edit((d) => {
                d.tiebreak.expected = v;
              })
            }
          />
        </>
      }
    />
  );
}
