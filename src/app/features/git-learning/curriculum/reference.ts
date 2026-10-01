export const commandReference = [
  [
    'reference.startAndInspect',
    'git init · git status · git diff · git log --oneline --graph',
    'reference.workingTreeStagingAreaIndexSavedSnapshot',
  ],
  [
    'reference.saveASnapshot',
    'git add .\ngit commit -m "Describe the change"',
    'reference.addStagesTheCurrentVersionCommitSaves',
  ],
  [
    'reference.branchAndMerge',
    'git switch -c venue\ngit switch main\ngit merge venue',
    'reference.aBranchPointsToACommitFor',
  ],
  [
    'reference.saveADraft',
    'git stash push -m "Draft"\ngit stash apply\ngit stash pop',
    'reference.applyKeepsTheEntryPopDropsIt',
  ],
  [
    'reference.exchangeWork',
    'git fetch\ngit pull --ff-only\ngit push',
    'reference.fetchUpdatesYourKnowledgeOfTheRemote',
  ],
  [
    'reference.correctSafely',
    'git commit --amend -m "Correction"\ngit reset --soft HEAD~1\ngit revert HEAD',
    'reference.amendAndResetAreForUnpublishedLocal',
  ],
];
