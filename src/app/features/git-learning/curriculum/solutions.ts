import { changed, headTree, tip } from '../domain/engine';
import type { BoothSession } from '../state/session';
import { challenges, requirements } from './challenges';

export type SolutionStep =
  | { kind: 'command'; label: string; command: string }
  | { kind: 'edit'; label: string; file: string; content: string }
  | { kind: 'save'; label: string; file: string }
  | { kind: 'choose'; label: string }
  | { kind: 'predict'; label: string };

const command = (value: string): SolutionStep => ({
  kind: 'command',
  command: value,
  label: 'solutions.executedTheCommandToCompleteTheRemaining',
});

/** Choose ONE action from the live repository, never replay or restore a checkpoint. */
export function nextSolution(s: BoothSession): SolutionStep | null {
  if (requirements(s).every((goal) => goal.done) && !Object.keys(s.drafts).length) return null;
  const draft = Object.hasOwn(s.drafts, s.selectedFile) ? s.selectedFile : Object.keys(s.drafts)[0];
  if (draft)
    return { kind: 'save', file: draft, label: 'solutions.savedYourCurrentDraftToTheWorking' };
  const g = s.git,
    tree = headTree(g),
    id = challenges[s.step].id;
  const did = (value: string) => s.observed.includes(value);
  const effect = (value: string) => s.effects.includes(value);
  const has = (text: string | undefined, value: string) => !!text?.includes(value);
  const sameTip = tip(g) === tip(s.checkpointGit);
  const unstaged = changed(g.index, g.working).length > 0;
  const saveCommit = () => command(unstaged ? 'git add .' : 'git commit -m "Complete challenge"');
  const switchTo = (branch: string) => (g.head !== branch ? command(`git switch ${branch}`) : null);
  const edit = (file: string, content: string): SolutionStep => ({
    kind: 'edit',
    file,
    content,
    label: 'solutions.editedTheDraftForTheRequiredStep',
  });
  const field = (name: string, value: string) => {
    const text = g.working['event.txt'] ?? '';
    const pattern = new RegExp(`^${name}:.*$`, 'm');
    return edit(
      'event.txt',
      pattern.test(text)
        ? text.replace(pattern, `${name}: ${value}`)
        : `${text}\n${name}: ${value}`,
    );
  };
  const line = (value: string, replace?: string) => {
    const text = g.working['program.txt'] ?? '';
    return edit(
      'program.txt',
      replace && text.includes(replace) ? text.replace(replace, value) : `${text}\n${value}`,
    );
  };
  const resolve = (venue: string) => {
    // Keep the current branch's non-conflicting fields, changing only the requested decision.
    const base = (tree['event.txt'] ?? '')
      .replace(/^Venue:.*$/m, `Venue: ${venue}`)
      .replace(/^Time:.*$/m, 'Time: 13:00');
    return edit('event.txt', base);
  };
  switch (id) {
    case 'problem':
      return !s.introChoice
        ? { kind: 'choose', label: 'solutions.selectedVersionAToRevealTheLost' }
        : command('git init');
    case 'first':
      return saveCommit();
    case 'staging': {
      if (!has(tree['event.txt'], 'Auditorium')) {
        if (!has(g.index['event.txt'], 'Auditorium'))
          return !has(g.working['event.txt'], 'Auditorium')
            ? field('Venue', 'Auditorium')
            : command('git add event.txt');
        if (!has(g.working['event.txt'], 'Library')) return field('Venue', 'Library');
        if (s.prediction !== 'Auditorium')
          return { kind: 'predict', label: 'solutions.theStagedAuditoriumVersionIsWhatEnters' };
        return command('git commit -m "Staged venue"');
      }
      if (!has(g.working['event.txt'], 'Library')) return field('Venue', 'Library');
      return { kind: 'predict', label: 'solutions.theCommitTakesTheIndexVersionAuditorium' };
    }
    case 'save':
      return !did('git diff')
        ? command('git diff')
        : !has(g.working['event.txt'], 'Library')
          ? field('Venue', 'Library')
          : saveCommit();
    case 'branch':
      return g.head !== 'venue'
        ? command(g.branches['venue'] ? 'git switch venue' : 'git switch -c venue')
        : !has(g.working['event.txt'], 'Auditorium')
          ? field('Venue', 'Auditorium')
          : saveCommit();
    case 'merge':
      return (
        switchTo('main') ??
        (!has(g.working['program.txt'], '13:00 Workshop')
          ? line('13:00 Workshop')
          : changed(tree, g.working).length || changed(tree, g.index).length
            ? saveCommit()
            : command('git merge venue'))
      );
    case 'time-branch':
      return g.head !== 'time'
        ? command(g.branches['time'] ? 'git switch time' : 'git switch -c time')
        : !has(g.working['event.txt'], 'Time: 12:00')
          ? field('Time', '12:00')
          : saveCommit();
    case 'collision':
      return (
        switchTo('main') ??
        (!has(g.working['event.txt'], 'Time: 14:00')
          ? field('Time', '14:00')
          : changed(tree, g.working).length || changed(tree, g.index).length
            ? saveCommit()
            : command('git merge time'))
      );
    case 'abort':
      return command('git merge --abort');
    case 'retry-merge':
      return command('git merge time');
    case 'resolve':
      return /^(<<<<<<<|=======|>>>>>>>)/m.test(g.working['event.txt']) ||
        !has(g.working['event.txt'], 'Time: 13:00')
        ? resolve('Auditorium')
        : saveCommit();
    case 'push':
      return command(!did('git remote -v') ? 'git remote -v' : 'git push');
    case 'fetch':
      return command('git fetch');
    case 'pull':
      return command('git pull --ff-only');
    case 'local-error':
      return !has(g.working['program.txt'], '16:00 Wrong') ? line('16:00 Wrong') : saveCommit();
    case 'amend':
      return !has(g.working['program.txt'], '16:00 Review')
        ? line('16:00 Review', '16:00 Wrong')
        : unstaged
          ? command('git add program.txt')
          : command('git commit --amend -m "Review session"');
    case 'soft-reset':
      return command('git reset --soft HEAD~1');
    case 'recommit':
      return saveCommit();
    case 'unstage':
      return !has(g.working['event.txt'], 'Courtyard')
        ? field('Venue', 'Courtyard')
        : !effect('staged')
          ? command('git add event.txt')
          : command('git restore --staged event.txt');
    case 'discard':
      return command('git restore event.txt');
    case 'stash-save':
      return !has(g.working['program.txt'], '17:00 Draft')
        ? line('17:00 Draft')
        : unstaged
          ? command('git add program.txt')
          : command('git stash push -m "Draft schedule"');
    case 'stash-apply':
      return !did('git switch venue')
        ? command('git switch venue')
        : (switchTo('main') ?? command('git stash apply'));
    case 'stash-drop':
      return g.stashes.length ? command('git stash drop') : saveCommit();
    case 'stash-pop': {
      if (g.stashes.length) return command('git stash pop');
      if (!effect('stashed'))
        return !has(g.working['program.txt'], '18:00 Demo')
          ? line('18:00 Demo')
          : command('git stash push -m "Demo draft"');
      return saveCommit();
    }
    case 'stash-conflict': {
      if (!g.stashes.length)
        return !has(g.working['event.txt'], 'Courtyard')
          ? field('Venue', 'Courtyard')
          : command('git stash push -m "Courtyard draft"');
      if (!has(tree['event.txt'], 'Studio'))
        return !has(g.working['event.txt'], 'Studio') ? field('Venue', 'Studio') : saveCommit();
      return command('git stash pop');
    }
    case 'stash-resolve': {
      if (
        /^(<<<<<<<|=======|>>>>>>>)/m.test(g.working['event.txt']) ||
        !has(g.working['event.txt'], 'Venue: Courtyard') ||
        !has(g.working['event.txt'], 'Time: 13:00')
      )
        return resolve('Courtyard');
      if (
        sameTip ||
        g.stashConflicts.length ||
        changed(tree, g.working).length ||
        changed(tree, g.index).length
      )
        return saveCommit();
      return command('git stash drop');
    }
    case 'shared-error':
      return !has(g.working['event.txt'], 'Cancelled')
        ? field('Venue', 'Cancelled')
        : sameTip || changed(tree, g.working).length || changed(tree, g.index).length
          ? saveCommit()
          : command('git push');
    case 'revert':
      return command(!effect('reverted') ? 'git revert HEAD' : 'git push');
    case 'team-diverge':
      return !has(g.working['event.txt'], 'Time: 14:00')
        ? field('Time', '14:00')
        : sameTip || changed(tree, g.working).length || changed(tree, g.index).length
          ? saveCommit()
          : command('git push');
    case 'team-sync':
      return command(
        g.tracking['main'] !== 'r002' && !has(tree['program.txt'], '19:00 Team review')
          ? 'git fetch'
          : !effect('ff-rejected')
            ? 'git pull --ff-only'
            : !has(tree['program.txt'], '19:00 Team review')
              ? 'git merge origin/main'
              : 'git push',
      );
    default:
      return null;
  }
}
