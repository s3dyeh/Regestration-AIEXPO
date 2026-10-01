import { clean, headTree, tip } from '../domain/engine';
import type { BoothSession } from '../state/session';
import {
  mergeRecoveryChallenges,
  recoveryChallenges,
  recoveryRequirements,
} from './recovery-challenges';

export interface Challenge {
  id: string;
  title: string;
  instruction: string;
  commands: string[];
  hint: string;
  scene:
    'collision' | 'snapshot' | 'graph' | 'conflict' | 'remote' | 'finish' | 'recovery' | 'stash';
  mode?: 'solo' | 'team';
  edit?: {
    file: string;
    find?: string;
    value: string;
    label: string;
    params?: { value: string };
  }[];
}
const venue = (find: string, value: string) => ({
  file: 'event.txt',
  find,
  value,
  label: 'edit.venue',
  params: { value },
});
const time = (find: string, value: string) => ({
  file: 'event.txt',
  find,
  value,
  label: 'edit.time',
  params: { value },
});
export const challenges: Challenge[] = [
  {
    id: 'problem',
    title: 'challenges.twoEditsOneFileWhatGetsLost',
    instruction: 'challenges.replaceTheFileWithEitherVersionThen',
    scene: 'collision',
    commands: ['git init', 'git status'],
    hint: 'challenges.replacingAnEntireFileCanEraseAnother',
  },
  {
    id: 'first',
    title: 'challenges.createYourFirstSafeCheckpoint',
    instruction: 'challenges.stageBothFilesThenSaveYourFirst',
    scene: 'snapshot',
    commands: ['git status', 'git add .', 'git diff --staged', 'git commit -m "First snapshot"'],
    hint: 'challenges.addStagesContentCommitSavesOnlyStaged',
  },
  {
    id: 'staging',
    title: 'challenges.doesACommitIncludeTheLatestEdit',
    instruction: 'challenges.changeRoomAToAuditoriumSaveThe',
    scene: 'snapshot',
    commands: [
      'git add event.txt',
      'git diff',
      'git diff --staged',
      'git commit -m "Staged venue"',
    ],
    hint: 'challenges.orderMattersAuditoriumSaveFileAddLibrary',
    edit: [venue('Room A', 'Auditorium'), venue('Auditorium', 'Library')],
  },
  {
    id: 'save',
    title: 'challenges.saveTheRemainingEdit',
    instruction: 'challenges.libraryExistsOnlyInTheWorkingFiles',
    scene: 'snapshot',
    commands: [
      'git diff',
      'git add .',
      'git commit -m "Save library"',
      'git log --oneline --graph',
    ],
    hint: 'challenges.newContentNeedsAnotherAddThePrevious',
  },
  {
    id: 'branch',
    title: 'challenges.branchOutToTryAChange',
    instruction: 'challenges.createAndSwitchToTheVenueBranch',
    scene: 'graph',
    commands: [
      'git switch -c venue',
      'git branch',
      'git add .',
      'git commit -m "Venue experiment"',
    ],
    hint: 'challenges.startWithSwitchCBeforeEditingWatch',
    edit: [venue('Library', 'Auditorium')],
  },
  {
    id: 'merge',
    title: 'challenges.combineTwoEditsWithoutLosingEither',
    instruction: 'challenges.returnToMainAdd1300Workshop',
    scene: 'graph',
    commands: ['git switch main', 'git add .', 'git commit -m "Add workshop"', 'git merge venue'],
    hint: 'challenges.libraryReturnsOnMainAfterCommittingThe',
    edit: [
      {
        file: 'program.txt',
        value: '10:00 Welcome\n11:00 Git booth\n13:00 Workshop',
        label: 'challenges.addWorkshopToTheProgram',
      },
    ],
  },
  {
    id: 'time-branch',
    title: 'challenges.tryADifferentTime',
    instruction: 'challenges.createTheTimeBranchChange1000',
    scene: 'graph',
    commands: ['git switch -c time', 'git add .', 'git commit -m "Time at noon"'],
    hint: 'challenges.thisEditIsIndependentOfMainNext',
    edit: [time('10:00', '12:00')],
  },
  {
    id: 'collision',
    title: 'challenges.changeTheSameLineOnTheOther',
    instruction: 'challenges.returnToMainChange1000To',
    scene: 'conflict',
    commands: ['git switch main', 'git add .', 'git commit -m "Time at two"', 'git merge time'],
    hint: 'challenges.afterCommittingBothTimesOnSeparateBranches',
    edit: [time('10:00', '14:00')],
  },
  ...mergeRecoveryChallenges,
  {
    id: 'resolve',
    title: 'challenges.youDecideGitRecordsTheDecision',
    instruction: 'challenges.removeTheConflictMarkersFromEventTxt',
    scene: 'conflict',
    commands: ['git status', 'git add event.txt', 'git commit -m "Agree on time"'],
    hint: 'challenges.keepTheVenueAndEventLinesWith',
  },
  {
    id: 'push',
    title: 'challenges.hasYourHistoryReachedTheOtherMachine',
    instruction: 'challenges.anEmptyRemoteRepositoryIsConnectedInside',
    scene: 'remote',
    commands: ['git remote -v', 'git push'],
    hint: 'challenges.commitIsLocalPushTransfersHistoryAnd',
  },
  {
    id: 'fetch',
    title: 'challenges.fetchTheChangeWithoutTouchingYourFiles',
    instruction: 'challenges.theRemoteAdded1500TestingUse',
    scene: 'remote',
    commands: ['git fetch', 'git status'],
    hint: 'challenges.fetchUpdatesYourKnowledgeOfTheRemote',
  },
  {
    id: 'pull',
    title: 'challenges.moveYourBranchToTheNewHistory',
    instruction: 'challenges.theHistoryIsNowLocalUpdateMain',
    scene: 'remote',
    commands: ['git pull --ff-only', 'git log --oneline --graph'],
    hint: 'challenges.pullFfOnlySucceedsWhenTheBranch',
  },
  ...recoveryChallenges,
  {
    id: 'finish',
    title: 'challenges.youBuiltThisHistoryWithYourCommands',
    instruction: 'challenges.fromAnEasilyOverwrittenFileToSnapshots',
    scene: 'finish',
    commands: [],
    hint: '',
  },
];

export function requirements(s: BoothSession): { label: string; done: boolean }[] {
  const recovery = recoveryRequirements(s, challenges[s.step].id);
  if (recovery) return recovery;
  const g = s.git,
    tree = headTree(g),
    saved = tree['event.txt'] ?? '',
    working = g.working['event.txt'] ?? '';
  const did = (command: string) => s.observed.includes(command);
  const goal = (label: string, done: unknown) => ({ label, done: Boolean(done) });
  const newCommit = tip(g) !== tip(s.checkpointGit);
  switch (challenges[s.step].id) {
    case 'problem':
      return [
        goal('challenges.tryReplacingTheFileWithEitherVersion', s.introChoice),
        goal('challenges.createTheLocalRepository', g.initialized),
      ];
    case 'first':
      return [
        goal('challenges.bothFilesAreInTheFirstCommit', tree['event.txt'] && tree['program.txt']),
        goal('challenges.workingFilesAreFullyCommitted', clean(g)),
      ];
    case 'staging':
      return [
        goal('challenges.predictTheCommitContentFromTheIndex', s.prediction === 'Auditorium'),
        goal('challenges.theCommitContainsAuditorium', newCommit && saved.includes('Auditorium')),
        goal('challenges.theWorkingFileKeepsLibrary', working.includes('Library')),
      ];
    case 'save':
      return [
        goal('challenges.compareTheUnstagedChange', did('git diff')),
        goal(
          'challenges.libraryIsCommittedWithNoRemainingChanges',
          newCommit && saved.includes('Library') && clean(g),
        ),
      ];
    case 'branch':
      return [
        goal(
          'challenges.headIsOnVenueWhileMainStays',
          g.head === 'venue' && g.branches['main'] === s.checkpointGit.branches['main'],
        ),
        goal(
          'challenges.commitAuditoriumOnTheNewBranch',
          saved.includes('Auditorium') && newCommit && clean(g),
        ),
      ];
    case 'merge':
      return [
        goal(
          'challenges.mergeBothPathsOnMainWithTwo',
          g.head === 'main' && g.commits[tip(g) ?? '']?.parents.length === 2,
        ),
        goal(
          'challenges.commitBothTheVenueAndProgramChanges',
          saved.includes('Auditorium') && tree['program.txt']?.includes('Workshop') && clean(g),
        ),
      ];
    case 'time-branch':
      return [
        goal(
          'challenges.commit1200OnTimeWithoutMoving',
          g.head === 'time' &&
            saved.includes('Time: 12:00') &&
            g.branches['main'] === s.checkpointGit.branches['main'] &&
            clean(g),
        ),
      ];
    case 'collision':
      return [
        goal('challenges.mainContains1400', g.head === 'main' && saved.includes('Time: 14:00')),
        goal(
          'challenges.theMergeRevealsAConflictInEvent',
          g.merging?.branch === 'time' && g.merging.unresolved.includes('event.txt'),
        ),
      ];
    case 'resolve':
      return [
        goal(
          'challenges.commitThe1300DecisionWithoutConflict',
          saved.includes('Time: 13:00') &&
            saved.includes('Venue: Auditorium') &&
            saved.includes('Event: Campus Code Day') &&
            !/^(<<<<<<<|=======|>>>>>>>)/m.test(saved),
        ),
        goal(
          'challenges.finishTheMergeWithATwoParent',
          !g.merging && newCommit && g.commits[tip(g) ?? '']?.parents.length === 2 && clean(g),
        ),
      ];
    case 'push':
      return [
        goal('challenges.inspectTheOriginUrl', did('git remote -v')),
        goal(
          'challenges.remoteMainMatchesLocalMain',
          tip(g) && g.remote?.branches['main'] === tip(g),
        ),
      ];
    case 'fetch':
      return [
        goal('challenges.originMainKnowsAboutTheNewChange', g.tracking['main'] === 'r001'),
        goal(
          'challenges.mainAndYourFilesAreUnchanged',
          tip(g) === tip(s.checkpointGit) && !g.working['program.txt']?.includes('Testing'),
        ),
      ];
    case 'pull':
      return [
        goal('challenges.mainReachesR001WithoutAMergeCommit', tip(g) === 'r001'),
        goal(
          'challenges.testingReachesTheProgramFile',
          g.working['program.txt']?.includes('Testing') && clean(g),
        ),
      ];
    default:
      return [];
  }
}
