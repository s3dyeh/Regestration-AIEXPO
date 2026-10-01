/** Quoted tokens; rejects shell operators rather than pretending to implement a shell. */
export function tokenize(line: string): string[] {
  const out: string[] = [];
  let word = '',
    quote = '',
    active = false;
  for (const ch of line.trim()) {
    if (quote) {
      if (ch === quote) quote = '';
      else word += ch;
      active = true;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      active = true;
    } else if (/\s/.test(ch)) {
      if (active) {
        out.push(word);
        word = '';
        active = false;
      }
    } else {
      if (';&|<>`'.includes(ch))
        throw new Error('Shell operators are not supported. Run one Git command at a time.');
      word += ch;
      active = true;
    }
  }
  if (quote) throw new Error('Unclosed quotation mark. Example: git commit -m "Save venue"');
  if (active) out.push(word);
  return out;
}
export const commands = [
  'help',
  'clear',
  'git init',
  'git status',
  'git add .',
  'git commit -m "Save changes"',
  'git diff',
  'git diff --staged',
  'git log --oneline --graph',
  'git branch',
  'git switch main',
  'git switch -c venue',
  'git merge venue',
  'git merge --abort',
  'git commit --amend -m "Correct last commit"',
  'git reset --soft HEAD~1',
  'git revert HEAD',
  'git restore --staged event.txt',
  'git restore event.txt',
  'git stash push -m "Work in progress"',
  'git stash list',
  'git stash show',
  'git stash apply',
  'git stash apply --index',
  'git stash pop',
  'git stash drop',
  'git remote -v',
  'git push',
  'git fetch',
  'git pull --ff-only',
];
export const validBranch = (name: string) =>
  /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name) &&
  !['HEAD', '__proto__', 'constructor', 'prototype'].includes(name);
