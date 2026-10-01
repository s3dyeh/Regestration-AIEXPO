/** Public simulation interface. Commands return a new state or the unchanged input on failure. */
import {
  copy,
  tip,
  headTree,
  changed,
  same,
  clean,
  ancestorDistances,
  createCommit,
  diff,
  isAncestor,
  type GitState,
  type Result,
  type Event,
} from './model';
import { commands, tokenize, validBranch } from './parser';
import { integrate } from './merge';
import { abortMerge, amend, requireNoOperation, revertHead, softReset, stash } from './recovery';

export { copy, tip, headTree, changed, clean, resetSession, editFile, isAncestor } from './model';
export type { GitState, Result, Event, Files, Commit, Repository } from './model';
export { commands, tokenize } from './parser';

export function execute(command: string, state: GitState): Result {
  const s = copy(state);
  let output: string;
  let event: Event = { kind: 'inspect', text: 'engine.inspectingTheStateDoesNotChangeProject' };
  try {
    const tokens = tokenize(command);
    const [program, verb, ...args] = tokens;
    const exact = (condition: boolean, usage: string) => {
      if (!condition) throw new Error(`Usage in this lab: ${usage}`);
    };
    if (!tokens.length) return { state, output: '', events: [] };
    if (program === 'help' || program === 'clear') {
      exact(tokens.length === 1, program);
      return {
        state,
        output: program === 'help' ? commands.join('\n') : '',
        events: [
          {
            kind: program,
            text:
              program === 'clear'
                ? 'engine.clearedOnlyTheTerminalOutputTheRepository'
                : 'engine.theseCommandsAreAvailableInTheSimulation',
          },
        ],
      };
    }
    if (program !== 'git')
      throw new Error('This is a Git teaching simulation, not an OS shell. Type help.');
    if (verb === 'init') {
      exact(args.length === 0, 'git init');
      if (s.initialized) output = 'Reinitialized existing educational repository.';
      else {
        s.initialized = true;
        output = 'Initialized empty educational repository (.git model).';
        event = {
          kind: 'init',
          text: 'engine.createdALocalHistoryDatabaseNoFiles',
        };
      }
    } else {
      if (!s.initialized) throw new Error('Not a Git repository. Run git init.');
      switch (verb) {
        case 'status': {
          exact(!args.length, 'git status');
          const staged = changed(headTree(s), s.index),
            unstaged = changed(s.index, s.working).filter((f) => f in s.index),
            untracked = Object.keys(s.working).filter((f) => !(f in s.index));
          output =
            `On branch ${s.head}\nHEAD → ${tip(s) ?? '(no commits)'}\n` +
            (s.merging
              ? `Merge in progress\nUnmerged paths: ${s.merging.unresolved.join(', ') || '(all resolved; commit to finish)'}\n`
              : '') +
            (s.stashConflicts.length ? `Stash conflicts: ${s.stashConflicts.join(', ')}\n` : '') +
            `\nChanges staged:\n${staged.join('\n') || '  (none)'}\nChanges not staged:\n${unstaged.join('\n') || '  (none)'}\nUntracked files:\n${untracked.join('\n') || '  (none)'}`;
          break;
        }
        case 'add': {
          exact(
            args.length > 0 && !args.some((a) => a.startsWith('-')),
            'git add <file...> | git add .',
          );
          const files = args.includes('.') ? Object.keys({ ...s.index, ...s.working }) : args;
          for (const f of files) {
            if (!Object.hasOwn(s.working, f) && !Object.hasOwn(s.index, f))
              throw new Error(`Path not found: ${f}`);
            if (
              (s.merging?.unresolved.includes(f) || s.stashConflicts.includes(f)) &&
              /^(<<<<<<<|=======|>>>>>>>)/m.test(s.working[f] ?? '')
            )
              throw new Error(
                'Remove conflict markers before staging. This lab checks that explicitly.',
              );
            if (Object.hasOwn(s.working, f)) s.index[f] = s.working[f];
            else delete s.index[f];
            if (s.merging) s.merging.unresolved = s.merging.unresolved.filter((x) => x !== f);
            s.stashConflicts = s.stashConflicts.filter((x) => x !== f);
          }
          output = `Staged: ${files.join(', ')}`;
          event = {
            kind: 'staged',
            text: 'engine.theIndexCapturedTheCurrentFileContent',
          };
          break;
        }
        case 'commit': {
          if (args[0] === '--amend') {
            exact(
              args.length === 3 && args[1] === '-m' && !!args[2].trim(),
              'git commit --amend -m "Message"',
            );
            ({ output, event } = amend(s, args[2]));
            break;
          }
          exact(
            args.length === 2 && args[0] === '-m' && !!args[1].trim(),
            'git commit -m "Message"',
          );
          if (s.merging?.unresolved.length || s.stashConflicts.length)
            throw new Error('Unresolved conflicts. Edit and stage every conflicted file first.');
          if (!s.merging && same(headTree(s), s.index))
            throw new Error('Nothing staged to commit. Edit a file and run git add.');
          const parents = tip(s) ? [tip(s)!] : [];
          if (s.merging) parents.push(s.merging.parent);
          const id = createCommit(s, args[1], parents);
          s.merging = null;
          output = `[${s.head} ${id}] ${args[1]}\n${parents.length} parent(s) · educational ID, not a real hash`;
          event = {
            kind: 'committed',
            text: 'engine.savedASnapshotFromTheIndexAnd',
          };
          break;
        }
        case 'diff':
          exact(
            !args.length || (args.length === 1 && args[0] === '--staged'),
            'git diff [--staged]',
          );
          output = args.length
            ? diff(headTree(s), s.index)
            : diff(
                s.index,
                Object.fromEntries(Object.entries(s.working).filter(([f]) => f in s.index)),
              );
          break;
        case 'log': {
          exact(
            !args.length ||
              (args.length === 2 && args.includes('--oneline') && args.includes('--graph')),
            'git log --oneline --graph',
          );
          const ids = tip(s) ? [...ancestorDistances(s, tip(s)!).keys()] : [];
          output =
            ids
              .map(
                (id) =>
                  `* ${id} ${s.commits[id].message}\n  parents: ${s.commits[id].parents.join(', ') || '(root)'}`,
              )
              .join('\n') || 'No commits yet.';
          break;
        }
        case 'branch': {
          exact(args.length <= 1, 'git branch [name]');
          if (!args.length)
            output = Object.entries(s.branches)
              .map(([b, id]) => `${b === s.head ? '*' : ' '} ${b} → ${id ?? '(empty)'}`)
              .join('\n');
          else {
            const name = args[0];
            if (!validBranch(name) || name in s.branches)
              throw new Error('Use a new branch name: letters, numbers, _ or -.');
            if (!tip(s)) throw new Error('Create the first commit before branching in this lab.');
            s.branches[name] = tip(s);
            output = `Created branch ${name}`;
            event = {
              kind: 'branch',
              text: 'engine.createdAnotherPointerToTheSameCommit',
            };
          }
          break;
        }
        case 'switch': {
          exact(
            (args.length === 1 && !args[0].startsWith('-')) ||
              (args.length === 2 && args[0] === '-c'),
            'git switch <branch> | git switch -c <new>',
          );
          if (s.merging || s.stashConflicts.length || !clean(s))
            throw new Error('Commit or stash your changes before switching in this lab.');
          const name = args.at(-1)!;
          if (args[0] === '-c') {
            if (!validBranch(name) || name in s.branches)
              throw new Error('Invalid or existing branch name.');
            if (!tip(s)) throw new Error('Create a commit before branching.');
            s.branches[name] = tip(s);
          }
          if (!(name in s.branches)) throw new Error(`Unknown branch: ${name}`);
          s.head = name;
          s.index = copy(headTree(s));
          s.working = copy(s.index);
          output = `Switched to branch '${name}'`;
          event = {
            kind: 'switched',
            text: 'engine.headNowPointsToTheSelectedBranch',
          };
          break;
        }
        case 'merge': {
          if (args.length === 1 && args[0] === '--abort') {
            ({ output, event } = abortMerge(s));
            break;
          }
          requireNoOperation(s);
          exact(args.length === 1 && !args[0].startsWith('-'), 'git merge <branch>');
          const target = s.branches[args[0]] ?? s.tracking[args[0].replace(/^origin\//, '')];
          if (!target) throw new Error(`Unknown or empty branch: ${args[0]}`);
          ({ output, event } = integrate(s, target, args[0], false));
          break;
        }
        case 'reset':
          exact(
            args.length === 2 && args[0] === '--soft' && args[1] === 'HEAD~1',
            'git reset --soft HEAD~1',
          );
          ({ output, event } = softReset(s));
          break;
        case 'revert':
          exact(
            args.length === 1 && args[0] === 'HEAD',
            'git revert HEAD (single-parent HEAD only in this lab)',
          );
          ({ output, event } = revertHead(s));
          break;
        case 'stash':
          ({ output, event } = stash(s, args));
          break;
        case 'restore': {
          const staged = args[0] === '--staged';
          const files = staged ? args.slice(1) : args;
          exact(
            files.length > 0 && !files.some((f) => f.startsWith('-')),
            'git restore [--staged] <file...>',
          );
          requireNoOperation(s);
          const source = staged ? headTree(s) : s.index;
          const target = staged ? s.index : s.working;
          for (const file of files) {
            if (!Object.hasOwn(source, file) && !Object.hasOwn(target, file))
              throw new Error(`Path not found: ${file}`);
            if (!staged && !Object.hasOwn(s.index, file))
              throw new Error(`Untracked file: ${file}`);
            if (Object.hasOwn(source, file)) target[file] = source[file];
            else delete target[file];
          }
          output = staged
            ? 'Index restored from HEAD. Working files unchanged.'
            : 'Working files restored from index.';
          event = {
            kind: staged ? 'unstaged' : 'restored',
            text: staged
              ? 'engine.unstagedTheEditAndKeptItIn'
              : 'engine.restoredTheWorkingFileFromTheIndex',
          };
          break;
        }
        case 'remote':
          exact(args.length === 1 && args[0] === '-v', 'git remote -v');
          output = s.remote
            ? 'origin  booth://github/event (fetch)\norigin  booth://github/event (push)\nSIMULATED · no network request'
            : 'No remote configured yet. Continue to the push challenge.';
          break;
        case 'push': {
          exact(!args.length, 'git push');
          if (!s.remote)
            throw new Error('No remote configured yet. Continue to the push challenge.');
          if (!tip(s)) throw new Error('No commits to push.');
          const rt = s.remote.branches[s.head] ?? null;
          if (rt && (!s.commits[rt] || !isAncestor(s, rt, tip(s))))
            throw new Error(
              'Push rejected (non-fast-forward). Fetch and integrate remote changes first.',
            );
          for (const id of ancestorDistances(s, tip(s)!).keys())
            s.remote.commits[id] = copy(s.commits[id]);
          s.remote.branches[s.head] = tip(s);
          s.tracking[s.head] = tip(s);
          output = `origin/${s.head} → ${tip(s)} (simulated push)`;
          event = {
            kind: 'pushed',
            text: 'engine.transferredCommitsAndRequiredContentToThe',
          };
          break;
        }
        case 'fetch':
        case 'pull': {
          exact(
            verb === 'fetch' ? !args.length : args.length === 1 && args[0] === '--ff-only',
            verb === 'fetch' ? 'git fetch' : 'git pull --ff-only',
          );
          if (!s.remote)
            throw new Error('No remote configured yet. Continue to the push challenge.');
          Object.assign(s.commits, copy(s.remote.commits));
          s.tracking = copy(s.remote.branches);
          if (verb === 'pull') {
            requireNoOperation(s);
            const target = s.tracking[s.head];
            if (!target) throw new Error('No matching remote branch.');
            ({ output, event } = integrate(s, target, `origin/${s.head}`, true));
          } else {
            output = 'Fetched remote history. Local branch and working files unchanged.';
            event = {
              kind: 'fetched',
              text: 'engine.fetchedHistoryAndUpdatedOriginYourBranch',
            };
          }
          break;
        }
        default:
          throw new Error(`Unsupported command: git ${verb ?? ''}. Type help for supported forms.`);
      }
    }
    return { state: s, output, events: [event] };
  } catch (e) {
    const error = (e as Error).message;
    return {
      state,
      output: error,
      error,
      events: [
        {
          kind: error.startsWith('Push rejected')
            ? 'push-rejected'
            : error.startsWith('Not possible to fast-forward')
              ? 'ff-rejected'
              : 'error',
          text: 'engine.theStateIsUnchangedCheckTheMessage',
        },
      ],
    };
  }
}
