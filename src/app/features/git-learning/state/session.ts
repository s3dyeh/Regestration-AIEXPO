import {
  copy,
  editFile,
  execute,
  headTree,
  tip,
  tokenize,
  type Files,
  type GitState,
} from '../domain/engine';
import { loadScenario } from '../domain/scenarios';
import { challenges, requirements } from '../curriculum/challenges';
import { nextSolution } from '../curriculum/solutions';

export interface TerminalEntry {
  command: string;
  output: string;
  error: boolean;
}
export interface BoothSession {
  step: number;
  checkpoint: number;
  group: number;
  git: GitState;
  checkpointGit: GitState;
  drafts: Files;
  selectedFile: string;
  transcript: TerminalEntry[];
  commandHistory: string[];
  observed: string[];
  effects: string[];
  explanation: string;
  introChoice: 'sara' | 'omar' | null;
  prediction: string | null;
  preferences: { projection: boolean; reducedMotion: boolean };
}
export type BoothAction =
  | { type: 'solution/next' }
  | { type: 'wizard/next' }
  | { type: 'wizard/retry' }
  | { type: 'session/reset' }
  | { type: 'terminal/execute'; command: string }
  | { type: 'editor/select'; file: string }
  | { type: 'editor/draft'; content: string }
  | { type: 'editor/save' }
  | { type: 'intro/choose'; choice: 'sara' | 'omar' }
  | { type: 'prediction'; value: string }
  | { type: 'preferences/toggle'; key: keyof BoothSession['preferences'] };
export function createSession(): BoothSession {
  const git = loadScenario('intro');
  return {
    step: 0,
    checkpoint: 0,
    group: 1,
    git,
    checkpointGit: copy(git),
    drafts: {},
    selectedFile: 'event.txt',
    transcript: [],
    commandHistory: [],
    observed: [],
    effects: [],
    explanation: 'جرّب استبدال الملف بإحدى النسختين. أي تعديل سيضيع؟',
    introChoice: null,
    prediction: null,
    preferences: { projection: false, reducedMotion: false },
  };
}
export function stationComplete(session: BoothSession) {
  return requirements(session).every((goal) => goal.done);
}
function enterStep(session: BoothSession, step: number, git: GitState): BoothSession {
  return {
    ...session,
    step,
    git,
    checkpointGit: copy(git),
    checkpoint: session.checkpoint + 1,
    drafts: {},
    selectedFile: 'event.txt',
    observed: [],
    effects: [],
    prediction: null,
    explanation: challenges[step].instruction,
  };
}
function transition(session: BoothSession, action: BoothAction): BoothSession {
  switch (action.type) {
    case 'solution/next': {
      const step = nextSolution(session);
      if (!step) return session;
      let next = session;
      switch (step.kind) {
        case 'command':
          return transition(session, { type: 'terminal/execute', command: step.command });
        case 'edit':
          next = transition(transition(session, { type: 'editor/select', file: step.file }), {
            type: 'editor/draft',
            content: step.content,
          });
          break;
        case 'save':
          next = transition(transition(session, { type: 'editor/select', file: step.file }), {
            type: 'editor/save',
          });
          break;
        case 'choose':
          next = transition(session, { type: 'intro/choose', choice: 'sara' });
          break;
        case 'predict':
          next = transition(session, { type: 'prediction', value: 'Auditorium' });
          break;
      }
      return { ...next, explanation: step.label };
    }
    case 'wizard/next': {
      if (!stationComplete(session) || session.step >= challenges.length - 1) return session;
      const step = session.step + 1;
      const git = copy(session.git);
      // Only the remote receives simulated external events. Local history stays intact.
      if (challenges[step].id === 'push') git.remote = { commits: {}, branches: { main: null } };
      if (challenges[step].id === 'fetch' && git.remote) {
        git.remote.commits['r001'] = {
          id: 'r001',
          parents: [tip(git)!],
          author: 'Remote teammate',
          message: 'Add testing session',
          tree: {
            ...copy(headTree(git)),
            'program.txt': headTree(git)['program.txt'] + '\n15:00 Testing',
          },
        };
        git.remote.branches['main'] = 'r001';
      }
      if (challenges[step].id === 'team-diverge' && git.remote) {
        const parent = git.remote.branches['main']!;
        git.remote.commits['r002'] = {
          id: 'r002',
          parents: [parent],
          author: 'Remote teammate',
          message: 'Team review session',
          tree: {
            ...copy(git.remote.commits[parent].tree),
            'program.txt': git.remote.commits[parent].tree['program.txt'] + '\n19:00 Team review',
          },
        };
        git.remote.branches['main'] = 'r002';
      }
      return enterStep(session, step, git);
    }
    case 'wizard/retry':
      return {
        ...enterStep(session, session.step, copy(session.checkpointGit)),
        introChoice: session.step === 0 ? null : session.introChoice,
      };
    case 'session/reset':
      return {
        ...createSession(),
        group: session.group + 1,
        checkpoint: session.checkpoint + 1,
        preferences: session.preferences,
      };
    case 'terminal/execute': {
      if (!action.command.trim()) return session;
      const result = execute(action.command, session.git);
      const drafts = { ...session.drafts };
      for (const file of Object.keys(drafts))
        if (session.git.working[file] !== result.state.working[file]) delete drafts[file];
      const observation = result.error ? '' : tokenize(action.command).slice(0, 3).join(' ');
      return {
        ...session,
        git: result.state,
        drafts,
        observed: result.error
          ? session.observed
          : [...new Set([...session.observed, observation])],
        effects: [...new Set([...session.effects, ...result.events.map((event) => event.kind)])],
        explanation: result.events.at(-1)?.text ?? session.explanation,
        transcript: result.events.some((e) => e.kind === 'clear')
          ? []
          : [
              ...session.transcript,
              { command: action.command, output: result.output, error: !!result.error },
            ].slice(-80),
        commandHistory: [...session.commandHistory, action.command].slice(-200),
      };
    }
    case 'editor/select':
      return Object.hasOwn(session.git.working, action.file)
        ? { ...session, selectedFile: action.file }
        : session;
    case 'editor/draft':
      return { ...session, drafts: { ...session.drafts, [session.selectedFile]: action.content } };
    case 'editor/save': {
      if (!Object.hasOwn(session.drafts, session.selectedFile)) return session;
      const drafts = { ...session.drafts };
      const git = editFile(session.git, session.selectedFile, drafts[session.selectedFile]);
      delete drafts[session.selectedFile];
      return {
        ...session,
        git,
        drafts,
        explanation: 'تغيّر ملف العمل. راقب الفرق بينه وبين الـindex والـcommit.',
      };
    }
    case 'intro/choose':
      return { ...session, introChoice: action.choice };
    case 'prediction':
      return { ...session, prediction: action.value };
    case 'preferences/toggle':
      return {
        ...session,
        preferences: { ...session.preferences, [action.key]: !session.preferences[action.key] },
      };
  }
}

export function boothReducer(session: BoothSession, action: BoothAction): BoothSession {
  return transition(session, action);
}
