import { z } from 'zod';
import { boothReducer, createSession, type BoothAction, type BoothSession } from './session';

export const progressKey = 'careerlens.git-learning.v1';
const text = z.string().max(20000);
const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('solution/next') }).strict(),
  z.object({ type: z.literal('wizard/next') }).strict(),
  z.object({ type: z.literal('wizard/retry') }).strict(),
  z.object({ type: z.literal('session/reset') }).strict(),
  z.object({ type: z.literal('terminal/execute'), command: text }).strict(),
  z.object({ type: z.literal('editor/select'), file: z.string().max(200) }).strict(),
  z.object({ type: z.literal('editor/draft'), content: text }).strict(),
  z.object({ type: z.literal('editor/save') }).strict(),
  z.object({ type: z.literal('intro/choose'), choice: z.enum(['sara', 'omar']) }).strict(),
  z.object({ type: z.literal('prediction'), value: text }).strict(),
  z
    .object({ type: z.literal('preferences/toggle'), key: z.enum(['projection', 'reducedMotion']) })
    .strict(),
]);
const journalSchema = z
  .object({
    version: z.literal(1),
    group: z.number().int().min(1).max(1000000),
    preferences: z.object({ projection: z.boolean(), reducedMotion: z.boolean() }).strict(),
    actions: z.array(actionSchema).max(1500),
  })
  .strict();
export type Journal = z.infer<typeof journalSchema>;
export interface LearningState {
  session: BoothSession;
  journal: Journal;
  recovered: boolean;
}
function journalFor(session: BoothSession): Journal {
  return { version: 1, group: session.group, preferences: session.preferences, actions: [] };
}
export function restoreProgress(raw: string | null): LearningState {
  const initial = createSession();
  if (!raw) return { session: initial, journal: journalFor(initial), recovered: false };
  try {
    if (raw.length > 1_000_000) throw new Error('Progress too large');
    const journal = journalSchema.parse(JSON.parse(raw));
    let session = { ...initial, group: journal.group, preferences: journal.preferences };
    for (const action of journal.actions) session = boothReducer(session, action);
    return { session, journal, recovered: false };
  } catch {
    return { session: initial, journal: journalFor(initial), recovered: true };
  }
}
export function learningReducer(state: LearningState, action: BoothAction): LearningState {
  const session = boothReducer(state.session, action);
  if (session === state.session) return state;
  if (action.type === 'session/reset')
    return { session, journal: journalFor(session), recovered: false };
  const actions = [...state.journal.actions];
  if (action.type === 'editor/draft' && actions.at(-1)?.type === 'editor/draft') actions.pop();
  actions.push(action);
  return { session, journal: { ...state.journal, actions }, recovered: state.recovered };
}
export function serializeProgress(journal: Journal): string {
  journalSchema.parse(journal);
  const raw = JSON.stringify(journal);
  if (raw.length > 1_000_000) throw new Error('Progress too large');
  return raw;
}
