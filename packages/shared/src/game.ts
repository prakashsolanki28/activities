import { z } from 'zod';

/*
 * Live team games: a facilitator runs the game from the Host console and the room watches a
 * projector display. Teams answer with printed cards and paper; the host records what they said.
 * Kept apart from activities and attempts: games have their own collection, routes and scoring.
 */

export const CARD_CHOICES = ['safe', 'danger', 'verify'] as const;
export type CardChoice = (typeof CARD_CHOICES)[number];
export const CARD_LABELS: Record<CardChoice, string> = { safe: 'Safe', danger: 'Danger', verify: 'Verify first' };

export const ROUND_IDS = ['r1', 'r2', 'r3', 'r4'] as const;
export type RoundId = (typeof ROUND_IDS)[number];

export const R2_RUBRIC_IDS = ['identified', 'warningSigns', 'response'] as const;
export type R2RubricId = (typeof R2_RUBRIC_IDS)[number];

export const GAME_MIN_TEAMS = 2;
export const GAME_MAX_TEAMS = 6;

const id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, 'Use letters, numbers, dashes or underscores');

/* ------------------------------------------------------------------ */
/* Teams                                                                */
/* ------------------------------------------------------------------ */

/** Team stages are named r2-<team id>, so these ids would clash with the fixed r2-intro and r2-scores stages. */
export const RESERVED_TEAM_IDS = ['intro', 'scores'];

export const teamSchema = z.object({
  id: id.refine((v) => !RESERVED_TEAM_IDS.includes(v), 'That team id is reserved'),
  name: z.string().trim().min(1, 'Give the team a name').max(40),
  emoji: z.string().max(16).default(''),
});
export type Team = z.infer<typeof teamSchema>;

export const teamsSchema = z
  .array(teamSchema)
  .min(GAME_MIN_TEAMS, `Add at least ${GAME_MIN_TEAMS} teams`)
  .max(GAME_MAX_TEAMS, `Up to ${GAME_MAX_TEAMS} teams`)
  .refine((ts) => new Set(ts.map((t) => t.id)).size === ts.length, 'Team ids must be unique')
  .refine((ts) => new Set(ts.map((t) => t.name.toLowerCase())).size === ts.length, 'Give every team a different name');

export const DEFAULT_TEAMS: Team[] = [
  { id: 'firewall', name: 'Team Firewall', emoji: '🔥' },
  { id: 'ninjas', name: 'Team Cyber Ninjas', emoji: '🥷' },
  { id: 'hackbusters', name: 'Team Hackbusters', emoji: '🕵️' },
  { id: 'defenders', name: 'Team Digital Defenders', emoji: '🛡️' },
];

/* ------------------------------------------------------------------ */
/* Content                                                              */
/* ------------------------------------------------------------------ */

export interface RoundMeta {
  title: string;
  /** e.g. "5 minutes · 20 points" */
  subtitle: string;
  intro: string;
  /** Short rules for the round's title slide. */
  rules: string[];
  /** Shown on the Host console only. */
  hostNotes: string[];
}

export interface R1Challenge {
  id: string;
  situation: string;
  answer: CardChoice;
  explanation: string;
}

export interface R2Card {
  id: string;
  title: string;
  /** What the volunteer acts out. Shown on the Host console and the printed card, never on the display before reveal. */
  brief: string;
  teamTask: string;
  warningSigns: string[];
  safeResponse: string[];
}

export interface R3Action {
  id: string;
  label: string;
  cost: number;
  /** +10 for a right action, −5 for a harmful one. */
  points: number;
}

export interface R4Situation {
  id: string;
  text: string;
  correctAction: string;
}

export interface GameContent {
  templateId: 'cyber-survivor';
  title: string;
  tagline: string;
  subtitle: string;
  championTitle: string;
  hostTips: string[];
  r1: RoundMeta & { answerSec: number; pointsEach: number; challenges: R1Challenge[] };
  r2: RoundMeta & {
    actSec: number;
    rubric: { id: R2RubricId; label: string; points: number }[];
    cards: R2Card[];
    safetyNote: string;
  };
  r3: RoundMeta & {
    planSec: number;
    budget: number;
    scenario: { title: string; text: string };
    actions: R3Action[];
    twist: { headline: string; text: string; question: string };
    lesson: string;
    facilitatorNote: string;
  };
  r4: RoundMeta & {
    missionSec: number;
    pointsEach: number;
    time: string;
    headline: string;
    mission: string;
    situations: R4Situation[];
  };
  tiebreak: { question: string; expected: string[]; rule: string; answerSec: number };
}

export const CYBER_SURVIVOR: GameContent = {
  templateId: 'cyber-survivor',
  title: 'Cyber Survivor',
  tagline: 'Trust your instincts!',
  subtitle: 'Teams. One mission. Can you survive the cyber traps?',
  championTitle: 'HRRL Cyber Survivor — Cybersecurity Awareness Champions',
  hostTips: [
    'Be energetic: this is a game, not a classroom session.',
    'Keep the countdown on the projector and let teams defend their answers.',
    'Make the Human Firewall round the highlight.',
    'Keep it friendly. The focus is learning, never embarrassing anyone.',
  ],
  r1: {
    title: 'Trust Your Instincts',
    subtitle: '5 minutes · 20 points',
    intro: 'Read the situation. Agree as a team in 15 seconds, then hold up one card. Every team answers at the same time.',
    rules: ['15 seconds to discuss', 'Hold up one card: Safe, Danger or Verify first', '5 points for each correct answer'],
    hostNotes: ['If a team gives the wrong answer, ask another team to explain the correct response. It keeps everyone involved.'],
    answerSec: 15,
    pointsEach: 5,
    challenges: [
      {
        id: 'c1',
        situation: 'Your manager sends you a WhatsApp message asking you to urgently transfer money to a vendor.',
        answer: 'verify',
        explanation: 'Verify the request through a known, independent contact, such as the number in the directory, before taking any action.',
      },
      {
        id: 'c2',
        situation: 'You receive an unexpected OTP even though you haven’t tried to log in.',
        answer: 'danger',
        explanation: 'Do not approve the request or share the OTP. Report it and check your account only through the approved channel.',
      },
      {
        id: 'c3',
        situation: 'A colleague asks you to lock your computer before leaving the office.',
        answer: 'safe',
        explanation: 'Locking your computer (Windows + L) stops anyone else from using your account while you are away.',
      },
      {
        id: 'c4',
        situation: 'You find a USB drive labelled “HRRL Salary Data” in the parking area.',
        answer: 'danger',
        explanation: 'Do not plug it into any computer. Hand it to the IT or security team.',
      },
    ],
  },
  r2: {
    title: 'The Human Firewall',
    subtitle: '10 minutes · 30 points',
    intro: 'Each team sends one volunteer to the front. The volunteer acts out a secret scenario without saying the words on the card. Their team guesses what is happening and explains the safest response.',
    rules: ['One volunteer acts, the team guesses', '2 minutes per team', '10 points each: the scenario, the warning signs, the right response'],
    hostNotes: ['Hand each volunteer their card face down. Only they read it.', 'Score each team on the three points below after they explain.'],
    actSec: 120,
    rubric: [
      { id: 'identified', label: 'Correctly identifies the scenario', points: 10 },
      { id: 'warningSigns', label: 'Identifies the security warning signs', points: 10 },
      { id: 'response', label: 'Explains the appropriate response', points: 10 },
    ],
    cards: [
      {
        id: 'A',
        title: 'The Fake IT Call',
        brief: 'You are pretending to be someone from IT. Act as if you urgently need an employee’s OTP to fix their account.',
        teamTask: 'Spot the warning signs and explain the correct response.',
        warningSigns: ['A caller says they are from IT and contacts you out of the blue', 'Pressure to act right now', 'Asks for an OTP, which nobody genuine ever needs'],
        safeResponse: ['Never share the OTP', 'End the call and contact IT on a number you already know', 'Report the call to the CISO Office'],
      },
      {
        id: 'B',
        title: 'The Urgent Boss',
        brief: 'Act as if you are a manager asking someone to send a confidential document to a personal email address because you are in a hurry.',
        teamTask: 'Explain what should be verified.',
        warningSigns: ['Urgency and pressure from a senior person', 'A confidential document is requested', 'It must go to a personal email address, outside official channels'],
        safeResponse: ['Verify the request with the manager through a known channel', 'Never send confidential documents to a personal email address', 'Report the request if it cannot be verified'],
      },
      {
        id: 'C',
        title: 'The Free Gift',
        brief: 'Act as if you have found a QR code promising a free smartphone and are trying to convince your colleagues to scan it.',
        teamTask: 'Identify the risks and explain how to check whether the offer is genuine.',
        warningSigns: ['Too good to be true: a free smartphone', 'A QR code from an unknown source', 'Excitement used to rush people into acting'],
        safeResponse: ['Do not scan unknown QR codes', 'Check the offer on the official website or with the organiser', 'Report suspicious QR codes or stickers'],
      },
      {
        id: 'D',
        title: 'The Suspicious Visitor',
        brief: 'Act as if you are a visitor who says they are an IT technician and has forgotten their access pass.',
        teamTask: 'Explain how the visitor should be verified.',
        warningSigns: ['No access pass or ID', 'Claims authority as an IT technician', 'Wants to get in without the usual checks'],
        safeResponse: ['Do not let them in or hold the door open', 'Send them to reception or security to confirm who they are', 'Check with the IT team that the visit was expected'],
      },
    ],
    safetyNote: 'Keep the role-play fictional. Nobody should ask for or give real passwords, OTPs or confidential information.',
  },
  r3: {
    title: 'The Cyber Auction',
    subtitle: '10 minutes · 30 points',
    intro: 'Each team has 100 Cyber Coins. Read what happened, then choose which actions deserve your limited budget. Spend wisely.',
    rules: ['100 Cyber Coins per team', '3 minutes to choose your actions', 'You cannot go over budget'],
    hostNotes: ['Record each team’s picks. After the twist, ask every team whether it wants to change its strategy and update the picks.'],
    planSec: 180,
    budget: 100,
    scenario: { title: 'Something suspicious happened!', text: 'An employee clicked an unexpected email link and entered their office password.' },
    actions: [
      { id: 'report', label: 'Report the incident through the approved channel', cost: 30, points: 10 },
      { id: 'secure', label: 'Follow the response team’s instructions to secure the account', cost: 30, points: 10 },
      { id: 'preserve', label: 'Preserve the suspicious email and relevant details', cost: 20, points: 10 },
      { id: 'ignore', label: 'Ignore the incident and hope nothing happens', cost: 10, points: -5 },
      { id: 'delete', label: 'Delete all evidence immediately', cost: 10, points: -5 },
    ],
    twist: {
      headline: 'New information!',
      text: 'The employee has now received an unexpected login notification.',
      question: 'Does your team want to change its strategy?',
    },
    lesson: 'Report it, secure the account with the response team, and keep the evidence. Ignoring it or deleting evidence makes things worse.',
    facilitatorNote: 'The coins are only a game mechanic. In a real incident, employees report promptly and the response team decides on containment and on keeping evidence.',
  },
  r4: {
    title: 'The Final Survival Challenge',
    subtitle: '10 minutes · 20 points',
    intro: 'All teams play at once. Four things go wrong in the office at the same time. Write down the safest response to each before the timer ends.',
    rules: ['3 minutes', 'Write one response for each situation', '5 points for each correct action'],
    hostNotes: ['Collect every team’s sheet when the timer ends, then tick the correct actions for each team.'],
    missionSec: 180,
    pointsEach: 5,
    time: '11:00 AM',
    headline: 'The office has a problem!',
    mission: 'You have three minutes to write down the safest response to all four situations.',
    situations: [
      { id: 'email', text: 'An employee receives a suspicious email.', correctAction: 'Report the suspicious email' },
      { id: 'otp', text: 'Another employee receives an unexpected OTP.', correctAction: 'Do not share the OTP or approve the unexpected request' },
      { id: 'usb', text: 'A colleague finds an unknown USB drive.', correctAction: 'Do not connect the unknown USB drive' },
      {
        id: 'payment',
        text: 'Someone gets a message from a person claiming to be the department head, asking for an urgent payment.',
        correctAction: 'Verify the payment request independently before taking any action',
      },
    ],
  },
  tiebreak: {
    question: 'You accidentally entered your office password on a suspicious website. What are the first two things you should do?',
    expected: ['Report the possible compromise immediately through the approved channel.', 'Follow the authorised response team’s instructions to secure the account.'],
    rule: 'The team that gives the clearest, safest answer wins.',
    answerSec: 60,
  },
};

export const GAME_TEMPLATES: Record<GameContent['templateId'], GameContent> = { 'cyber-survivor': CYBER_SURVIVOR };

/* ------------------------------------------------------------------ */
/* Scores and state                                                     */
/* ------------------------------------------------------------------ */

export const teamScoreSchema = z.object({
  /** Card each team held up, by challenge id. */
  r1: z.record(z.string(), z.enum(CARD_CHOICES).nullable()),
  /** card null = the default card for the team's position. */
  r2: z.object({ card: z.string().max(8).nullable(), identified: z.boolean(), warningSigns: z.boolean(), response: z.boolean() }),
  r3: z.object({ picks: z.array(id) }),
  /** Correct actions written down, by situation id. */
  r4: z.record(z.string(), z.boolean()),
  tiebreakWin: z.boolean(),
});
export type TeamScore = z.infer<typeof teamScoreSchema>;

export const emptyTeamScore = (): TeamScore => ({
  r1: {},
  r2: { card: null, identified: false, warningSigns: false, response: false },
  r3: { picks: [] },
  r4: {},
  tiebreakWin: false,
});

/**
 * A countdown. Running: endsAt is set and remainingSec is null. Paused: endsAt is null and
 * remainingSec holds what is left. Clients count down against serverNow, never the device clock.
 */
export interface GameTimer {
  durationSec: number;
  endsAt: string | null;
  remainingSec: number | null;
}

export interface GameState {
  stageId: string;
  /** Answers for the current stage are on the projector. Reset to false whenever the stage changes. */
  revealed: boolean;
  timer: GameTimer | null;
}

export const initialGameState = (): GameState => ({ stageId: 'lobby', revealed: false, timer: null });

/** Seconds left on a timer at `nowMs` (server-corrected). */
export function timerRemaining(timer: GameTimer | null, nowMs: number): number {
  if (!timer) return 0;
  if (timer.remainingSec != null) return timer.remainingSec;
  if (timer.endsAt) return Math.max(0, (new Date(timer.endsAt).getTime() - nowMs) / 1000);
  return timer.durationSec;
}

/* ------------------------------------------------------------------ */
/* Inputs                                                               */
/* ------------------------------------------------------------------ */

export const gameCreateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  teams: teamsSchema.optional(),
});
export type GameCreateInput = z.infer<typeof gameCreateSchema>;

/** Renaming teams is allowed any time; adding, removing or reordering teams only before the game starts (stage "lobby"). */
export const gameUpdateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  teams: teamsSchema.optional(),
});
export type GameUpdateInput = z.infer<typeof gameUpdateSchema>;

export const gameTimerActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start'), durationSec: z.number().int().min(5).max(1800) }),
  z.object({ action: z.literal('pause') }),
  z.object({ action: z.literal('resume') }),
  z.object({ action: z.literal('clear') }),
]);
export type GameTimerAction = z.infer<typeof gameTimerActionSchema>;

/**
 * Moving to a new stage hides answers and clears the timer, unless the same request also sets
 * `revealed` or `timer`. Fields apply in order: stage, then revealed, then timer.
 * `expectedStageId` is the stage the host was looking at: if the game has moved on (another tab),
 * the API refuses with 409 instead of revealing or timing the wrong stage.
 */
export const gameStateUpdateSchema = z
  .object({
    expectedStageId: z.string().min(1).max(80).optional(),
    stageId: z.string().min(1).max(80).optional(),
    revealed: z.boolean().optional(),
    timer: gameTimerActionSchema.optional(),
  })
  .refine((v) => v.stageId !== undefined || v.revealed !== undefined || v.timer !== undefined, 'Nothing to change');
export type GameStateUpdate = z.infer<typeof gameStateUpdateSchema>;

/** One scoring change for one team. The API applies it as a targeted update, so parallel taps never overwrite each other. */
export const teamScoreUpdateSchema = z.discriminatedUnion('round', [
  z.object({ round: z.literal('r1'), challengeId: id, choice: z.enum(CARD_CHOICES).nullable() }),
  z.object({
    round: z.literal('r2'),
    card: z.string().max(8).nullable().optional(),
    identified: z.boolean().optional(),
    warningSigns: z.boolean().optional(),
    response: z.boolean().optional(),
  }),
  z.object({ round: z.literal('r3'), picks: z.array(id).max(20) }),
  z.object({ round: z.literal('r4'), situationId: id, correct: z.boolean() }),
  /** Marking one team the winner clears the others. */
  z.object({ round: z.literal('tiebreak'), win: z.boolean() }),
]);
export type TeamScoreUpdate = z.infer<typeof teamScoreUpdateSchema>;

/* ------------------------------------------------------------------ */
/* Stages                                                               */
/* ------------------------------------------------------------------ */

export type StageKind =
  | 'lobby'
  | 'round-intro'
  | 'r1-challenge'
  | 'r2-team'
  | 'r3-auction'
  | 'r3-twist'
  | 'r3-reveal'
  | 'r4-mission'
  | 'r4-reveal'
  | 'scores'
  | 'tiebreak'
  | 'final';

export interface Stage {
  id: string;
  kind: StageKind;
  round: RoundId | null;
  /** Short label for the host's stage list, e.g. "Challenge 2". */
  label: string;
  challengeId?: string;
  teamId?: string;
  /** Suggested countdown for this stage. */
  timerSec?: number;
  /** The host presses Reveal to put this stage's answer on the projector. */
  revealable: boolean;
}

/**
 * Every stage in play order. The tie-breaker is included when `includeTiebreak` is true:
 * the API validates against the full list, while the host skips it when no tie exists.
 */
export function buildStages(content: GameContent, teams: Pick<Team, 'id' | 'name'>[], includeTiebreak = true): Stage[] {
  const s: Stage[] = [{ id: 'lobby', kind: 'lobby', round: null, label: 'Welcome', revealable: false }];
  s.push({ id: 'r1-intro', kind: 'round-intro', round: 'r1', label: `Round 1: ${content.r1.title}`, revealable: false });
  content.r1.challenges.forEach((c, i) =>
    s.push({ id: `r1-${c.id}`, kind: 'r1-challenge', round: 'r1', label: `Challenge ${i + 1}`, challengeId: c.id, timerSec: content.r1.answerSec, revealable: true }),
  );
  s.push({ id: 'r1-scores', kind: 'scores', round: 'r1', label: 'Scores after Round 1', revealable: false });
  s.push({ id: 'r2-intro', kind: 'round-intro', round: 'r2', label: `Round 2: ${content.r2.title}`, revealable: false });
  teams.forEach((t) => s.push({ id: `r2-${t.id}`, kind: 'r2-team', round: 'r2', label: t.name, teamId: t.id, timerSec: content.r2.actSec, revealable: true }));
  s.push({ id: 'r2-scores', kind: 'scores', round: 'r2', label: 'Scores after Round 2', revealable: false });
  s.push({ id: 'r3-intro', kind: 'round-intro', round: 'r3', label: `Round 3: ${content.r3.title}`, revealable: false });
  s.push({ id: 'r3-auction', kind: 'r3-auction', round: 'r3', label: 'The auction', timerSec: content.r3.planSec, revealable: false });
  s.push({ id: 'r3-twist', kind: 'r3-twist', round: 'r3', label: 'The twist', timerSec: 60, revealable: false });
  s.push({ id: 'r3-reveal', kind: 'r3-reveal', round: 'r3', label: 'Auction results', revealable: false });
  s.push({ id: 'r3-scores', kind: 'scores', round: 'r3', label: 'Scores after Round 3', revealable: false });
  s.push({ id: 'r4-intro', kind: 'round-intro', round: 'r4', label: `Round 4: ${content.r4.title}`, revealable: false });
  s.push({ id: 'r4-mission', kind: 'r4-mission', round: 'r4', label: 'The mission', timerSec: content.r4.missionSec, revealable: false });
  s.push({ id: 'r4-reveal', kind: 'r4-reveal', round: 'r4', label: 'Mission results', revealable: false });
  if (includeTiebreak) s.push({ id: 'tiebreak', kind: 'tiebreak', round: null, label: 'Tie-breaker', timerSec: content.tiebreak.answerSec, revealable: true });
  s.push({ id: 'final', kind: 'final', round: null, label: 'Champions', revealable: false });
  return s;
}

/** Stages whose answers are always on screen (no Reveal needed). */
const ALWAYS_REVEALED: StageKind[] = ['r3-reveal', 'r4-reveal', 'scores', 'final'];

export function answersVisible(stage: Pick<Stage, 'kind' | 'revealable'>, revealed: boolean): boolean {
  return ALWAYS_REVEALED.includes(stage.kind) || (stage.revealable && revealed);
}

export type GameStatus = 'setup' | 'live' | 'finished';

export function gameStatus(stageId: string): GameStatus {
  if (stageId === 'lobby') return 'setup';
  if (stageId === 'final') return 'finished';
  return 'live';
}

/* ------------------------------------------------------------------ */
/* Scoring: one set of rules for the API, Host console and display      */
/* ------------------------------------------------------------------ */

export interface TeamTotals {
  r1: number;
  r2: number;
  r3: number;
  r4: number;
  total: number;
}

export function roundMax(content: GameContent): TeamTotals {
  const r1 = content.r1.challenges.length * content.r1.pointsEach;
  const r2 = content.r2.rubric.reduce((n, r) => n + r.points, 0);
  const r3 = content.r3.actions.reduce((n, a) => n + Math.max(0, a.points), 0);
  const r4 = content.r4.situations.length * content.r4.pointsEach;
  return { r1, r2, r3, r4, total: r1 + r2 + r3 + r4 };
}

/** The Round 2 card a team acts out: the one the host chose, else the card for its position. */
export function r2CardFor(content: GameContent, teams: Pick<Team, 'id'>[], teamId: string, score: TeamScore | undefined): R2Card {
  const chosen = score?.r2.card ? content.r2.cards.find((c) => c.id === score.r2.card) : undefined;
  if (chosen) return chosen;
  const index = Math.max(0, teams.findIndex((t) => t.id === teamId));
  return content.r2.cards[index % content.r2.cards.length]!;
}

/** Cyber Coins spent on a set of picks (unknown ids cost nothing). */
export function auctionSpend(content: GameContent, picks: readonly string[]): number {
  return [...new Set(picks)].reduce((n, p) => n + (content.r3.actions.find((a) => a.id === p)?.cost ?? 0), 0);
}

export function scoreTeam(content: GameContent, score: TeamScore | undefined): TeamTotals {
  if (!score) return { r1: 0, r2: 0, r3: 0, r4: 0, total: 0 };
  const max = roundMax(content);
  const r1 = content.r1.challenges.filter((c) => score.r1[c.id] === c.answer).length * content.r1.pointsEach;
  const r2 = content.r2.rubric.reduce((n, r) => n + (score.r2[r.id] ? r.points : 0), 0);
  const picked = new Set(score.r3.picks);
  const raw3 = content.r3.actions.reduce((n, a) => n + (picked.has(a.id) ? a.points : 0), 0);
  const r3 = Math.min(Math.max(raw3, 0), max.r3);
  const r4 = content.r4.situations.filter((s) => score.r4[s.id]).length * content.r4.pointsEach;
  return { r1, r2, r3, r4, total: r1 + r2 + r3 + r4 };
}

export interface RankedTeam {
  team: Team;
  totals: TeamTotals;
  /** Teams with the same total and tie-break result share a rank. */
  rank: number;
  tiebreakWin: boolean;
}

export function rankTeams(content: GameContent, teams: Team[], scores: Record<string, TeamScore>): RankedTeam[] {
  const rows = teams.map((team, order) => ({ team, order, totals: scoreTeam(content, scores[team.id]), tiebreakWin: !!scores[team.id]?.tiebreakWin }));
  const better = (a: (typeof rows)[number], b: (typeof rows)[number]) =>
    b.totals.total - a.totals.total || Number(b.tiebreakWin) - Number(a.tiebreakWin);
  const sorted = [...rows].sort((a, b) => better(a, b) || a.order - b.order);
  return sorted.map((r) => ({
    team: r.team,
    totals: r.totals,
    tiebreakWin: r.tiebreakWin,
    rank: 1 + sorted.filter((o) => better(r, o) > 0).length,
  }));
}

/** Teams sharing the top total (empty when one team leads outright). */
export function tiedLeaders(ranked: RankedTeam[]): Team[] {
  if (!ranked.length) return [];
  const top = ranked[0]!.totals.total;
  const tied = ranked.filter((r) => r.totals.total === top);
  return tied.length > 1 ? tied.map((r) => r.team) : [];
}

/** A tie at the top that the host has not yet settled with the tie-breaker. */
export function needsTiebreak(ranked: RankedTeam[]): boolean {
  const tied = new Set(tiedLeaders(ranked).map((t) => t.id));
  return tied.size > 1 && !ranked.some((r) => tied.has(r.team.id) && r.tiebreakWin);
}

/** The winning team, or null while the top is still tied. */
export function champion(ranked: RankedTeam[]): Team | null {
  if (!ranked.length || needsTiebreak(ranked)) return null;
  return ranked[0]!.team;
}

/**
 * Scores as the room may see them at a given stage: a point only counts once its answer has been
 * on the projector. Without this, the score strip would give away answers before the reveal.
 */
export function visibleScores(
  content: GameContent,
  teams: Pick<Team, 'id' | 'name'>[],
  scores: Record<string, TeamScore>,
  stageId: string,
  revealed: boolean,
): Record<string, TeamScore> {
  const stages = buildStages(content, teams);
  const at = Math.max(0, stages.findIndex((s) => s.id === stageId));
  const shown = (sid: string) => {
    const i = stages.findIndex((s) => s.id === sid);
    return i >= 0 && (at > i || (at === i && revealed));
  };
  const reached = (sid: string) => {
    const i = stages.findIndex((s) => s.id === sid);
    return i >= 0 && at >= i;
  };
  const out: Record<string, TeamScore> = {};
  for (const t of teams) {
    const s = scores[t.id] ?? emptyTeamScore();
    const v = emptyTeamScore();
    for (const c of content.r1.challenges) if (shown(`r1-${c.id}`)) v.r1[c.id] = s.r1[c.id] ?? null;
    if (shown(`r2-${t.id}`)) v.r2 = { ...s.r2 };
    else v.r2.card = s.r2.card;
    if (reached('r3-reveal')) v.r3 = { picks: [...s.r3.picks] };
    if (reached('r4-reveal')) v.r4 = { ...s.r4 };
    v.tiebreakWin = shown('tiebreak') && s.tiebreakWin;
    out[t.id] = v;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* API shapes                                                           */
/* ------------------------------------------------------------------ */

/** Full game as the admin API returns it. */
export interface AdminGame {
  _id: string;
  code: string;
  title: string;
  content: GameContent;
  teams: Team[];
  /** Every team has an entry. */
  scores: Record<string, TeamScore>;
  state: GameState;
  status: GameStatus;
  /** Full totals by team id (the host sees everything, revealed or not). */
  totals: Record<string, TeamTotals>;
  serverNow: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminGameSummary {
  _id: string;
  code: string;
  title: string;
  teamCount: number;
  status: GameStatus;
  stageLabel: string;
  leader: { name: string; emoji: string; total: number } | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicScoreRow {
  teamId: string;
  totals: TeamTotals;
  rank: number;
  tiebreakWin: boolean;
}

/** What the current stage puts on the projector. Answer fields are present only once revealed. */
export type DisplayView =
  | { kind: 'lobby'; subtitle: string }
  | { kind: 'round-intro'; round: RoundId; number: number; title: string; subtitle: string; intro: string; rules: string[] }
  | {
      kind: 'r1-challenge';
      number: number;
      total: number;
      situation: string;
      answer?: CardChoice;
      explanation?: string;
      /** Card each team held up, by team id. */
      teamAnswers?: Record<string, CardChoice | null>;
    }
  | {
      kind: 'r2-team';
      teamId: string;
      number: number;
      total: number;
      safetyNote: string;
      card?: Pick<R2Card, 'id' | 'title' | 'warningSigns' | 'safeResponse'>;
    }
  | { kind: 'r3-auction'; scenario: { title: string; text: string }; budget: number; actions: Pick<R3Action, 'id' | 'label' | 'cost'>[] }
  | { kind: 'r3-twist'; headline: string; text: string; question: string }
  | { kind: 'r3-reveal'; actions: R3Action[]; picks: Record<string, string[]>; lesson: string }
  | { kind: 'r4-mission'; time: string; headline: string; mission: string; situations: Pick<R4Situation, 'id' | 'text'>[] }
  | { kind: 'r4-reveal'; situations: R4Situation[]; checks: Record<string, Record<string, boolean>> }
  | { kind: 'scores'; afterRound: RoundId }
  | { kind: 'tiebreak'; question: string; rule: string; tiedTeamIds: string[]; expected?: string[]; winnerTeamId?: string | null }
  | { kind: 'final'; championTitle: string; championTeamId: string | null };

/** GET /api/public/games/:code. Built from visibleScores, so nothing leaks before a reveal. */
export interface PublicGameDisplay {
  code: string;
  title: string;
  tagline: string;
  teams: Team[];
  stage: Pick<Stage, 'id' | 'kind' | 'round' | 'label'>;
  stageIndex: number;
  stageCount: number;
  revealed: boolean;
  timer: GameTimer | null;
  serverNow: string;
  max: TeamTotals;
  /** Ranked, best first. */
  scoreboard: PublicScoreRow[];
  view: DisplayView;
}

/**
 * The projector payload for a game. The only place that decides what the room may see:
 * answers appear once revealed, Round 2 card text never before its reveal, scores via visibleScores.
 */
export function buildPublicDisplay(
  game: { code: string; title: string; content: GameContent; teams: Team[]; scores: Record<string, TeamScore>; state: GameState },
  serverNow: Date = new Date(),
): PublicGameDisplay {
  const { content: c, teams, state } = game;
  const stages = buildStages(c, teams);
  const index = Math.max(0, stages.findIndex((s) => s.id === state.stageId));
  const stage = stages[index]!;
  const open = answersVisible(stage, state.revealed);
  const scores = visibleScores(c, teams, game.scores, stage.id, state.revealed);
  const ranked = rankTeams(c, teams, scores);
  const pick = <T>(m: Record<string, T>) => Object.fromEntries(teams.map((t) => [t.id, m[t.id]!]));

  let view: DisplayView;
  switch (stage.kind) {
    case 'lobby':
      view = { kind: 'lobby', subtitle: c.subtitle };
      break;
    case 'round-intro': {
      const r = c[stage.round!];
      view = { kind: 'round-intro', round: stage.round!, number: ROUND_IDS.indexOf(stage.round!) + 1, title: r.title, subtitle: r.subtitle, intro: r.intro, rules: r.rules };
      break;
    }
    case 'r1-challenge': {
      const i = c.r1.challenges.findIndex((x) => x.id === stage.challengeId);
      const ch = c.r1.challenges[i]!;
      view = {
        kind: 'r1-challenge',
        number: i + 1,
        total: c.r1.challenges.length,
        situation: ch.situation,
        ...(open ? { answer: ch.answer, explanation: ch.explanation, teamAnswers: pick(Object.fromEntries(teams.map((t) => [t.id, game.scores[t.id]?.r1[ch.id] ?? null]))) } : {}),
      };
      break;
    }
    case 'r2-team': {
      const i = teams.findIndex((t) => t.id === stage.teamId);
      const card = r2CardFor(c, teams, stage.teamId!, game.scores[stage.teamId!]);
      view = {
        kind: 'r2-team',
        teamId: stage.teamId!,
        number: i + 1,
        total: teams.length,
        safetyNote: c.r2.safetyNote,
        ...(open ? { card: { id: card.id, title: card.title, warningSigns: card.warningSigns, safeResponse: card.safeResponse } } : {}),
      };
      break;
    }
    case 'r3-auction':
      view = { kind: 'r3-auction', scenario: c.r3.scenario, budget: c.r3.budget, actions: c.r3.actions.map(({ id, label, cost }) => ({ id, label, cost })) };
      break;
    case 'r3-twist':
      view = { kind: 'r3-twist', ...c.r3.twist };
      break;
    case 'r3-reveal':
      view = { kind: 'r3-reveal', actions: c.r3.actions, picks: Object.fromEntries(teams.map((t) => [t.id, scores[t.id]!.r3.picks])), lesson: c.r3.lesson };
      break;
    case 'r4-mission':
      view = { kind: 'r4-mission', time: c.r4.time, headline: c.r4.headline, mission: c.r4.mission, situations: c.r4.situations.map(({ id, text }) => ({ id, text })) };
      break;
    case 'r4-reveal':
      view = { kind: 'r4-reveal', situations: c.r4.situations, checks: Object.fromEntries(teams.map((t) => [t.id, scores[t.id]!.r4])) };
      break;
    case 'scores':
      view = { kind: 'scores', afterRound: stage.round! };
      break;
    case 'tiebreak': {
      // Tied on the full scores: by the tie-breaker every round has been revealed.
      const full = rankTeams(c, teams, game.scores);
      const tied = tiedLeaders(full).map((t) => t.id);
      const winner = open ? (full.find((r) => r.tiebreakWin && tied.includes(r.team.id))?.team.id ?? null) : undefined;
      view = { kind: 'tiebreak', question: c.tiebreak.question, rule: c.tiebreak.rule, tiedTeamIds: tied, ...(open ? { expected: c.tiebreak.expected, winnerTeamId: winner } : {}) };
      break;
    }
    case 'final':
      view = { kind: 'final', championTitle: c.championTitle, championTeamId: champion(ranked)?.id ?? null };
      break;
  }

  return {
    code: game.code,
    title: game.title,
    tagline: c.tagline,
    teams,
    stage: { id: stage.id, kind: stage.kind, round: stage.round, label: stage.label },
    stageIndex: index,
    stageCount: stages.length,
    revealed: open,
    timer: state.timer,
    serverNow: serverNow.toISOString(),
    max: roundMax(c),
    scoreboard: ranked.map((r) => ({ teamId: r.team.id, totals: r.totals, rank: r.rank, tiebreakWin: r.tiebreakWin })),
    view,
  };
}
