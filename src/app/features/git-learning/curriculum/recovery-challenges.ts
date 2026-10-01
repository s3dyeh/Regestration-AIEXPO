import { changed, clean, headTree, tip } from '../domain/engine';
import type { BoothSession } from '../state/session';
import type { Challenge } from './challenges';

const program = '10:00 Welcome\n11:00 Git booth\n13:00 Workshop\n15:00 Testing';
const edit = (file: string, value: string, label: string, find?: string) => ({
  file,
  value,
  label,
  find,
});
export const mergeRecoveryChallenges: Challenge[] = [
  {
    id: 'abort',
    mode: 'team',
    title: 'recovery_challenges.notReadyToDecideAbortTheMerge',
    instruction: 'recovery_challenges.theMergeIsStillInProgressRun',
    scene: 'recovery',
    commands: ['git status', 'git merge --abort'],
    hint: 'recovery_challenges.abortCancelsOnlyTheOngoingOperationIt',
  },
  {
    id: 'retry-merge',
    mode: 'team',
    title: 'recovery_challenges.tryAgainThenResolveTheConflict',
    instruction: 'recovery_challenges.startMergingTimeAgainTheConflictMarkers',
    scene: 'conflict',
    commands: ['git merge time'],
    hint: 'recovery_challenges.abortingAMergeDoesNotDeleteEither',
  },
];
export const recoveryChallenges: Challenge[] = [
  {
    id: 'local-error',
    mode: 'solo',
    title: 'recovery_challenges.anAccidentalCommitStillOnlyLocal',
    instruction: 'recovery_challenges.add1600WrongToProgramTxt',
    scene: 'recovery',
    commands: ['git add program.txt', 'git commit -m "Wrong session"'],
    hint: 'recovery_challenges.theSimulationComparesLocalHeadWithThe',
    edit: [
      edit('program.txt', program + '\n16:00 Wrong', 'recovery_challenges.addAnIncorrectEntry'),
    ],
  },
  {
    id: 'amend',
    mode: 'solo',
    title: 'recovery_challenges.correctTheLastCommitBeforeSharing',
    instruction: 'recovery_challenges.replaceWrongWithReviewSaveAndStage',
    scene: 'recovery',
    commands: ['git add program.txt', 'git commit --amend -m "Review session"'],
    hint: 'recovery_challenges.amendCreatesAReplacementCommitItDoes',
    edit: [edit('program.txt', 'Review', 'recovery_challenges.correctWrongToReview', 'Wrong')],
  },
  {
    id: 'soft-reset',
    mode: 'solo',
    title: 'recovery_challenges.undoTheCommitKeepTheWork',
    instruction: 'recovery_challenges.useResetSoftHead1OnlyThe',
    scene: 'recovery',
    commands: ['git reset --soft HEAD~1', 'git diff --staged'],
    hint: 'recovery_challenges.softMovesHeadWithoutTouchingFilesOr',
  },
  {
    id: 'recommit',
    mode: 'solo',
    title: 'recovery_challenges.commitTheChangeAgain',
    instruction: 'recovery_challenges.theChangeIsStillStagedCommitIt',
    scene: 'recovery',
    commands: ['git diff --staged', 'git commit -m "Reviewed schedule"'],
    hint: 'recovery_challenges.afterASoftResetContentIsReady',
  },
  {
    id: 'unstage',
    mode: 'solo',
    title: 'recovery_challenges.stagedAFileByMistake',
    instruction: 'recovery_challenges.changeAuditoriumToCourtyardAndSaveRun',
    scene: 'snapshot',
    commands: ['git add event.txt', 'git restore --staged event.txt', 'git diff'],
    hint: 'recovery_challenges.restoreStagedUnstagesContentItDoesNot',
    edit: [
      edit('event.txt', 'Courtyard', 'recovery_challenges.changeTheVenueToCourtyard', 'Auditorium'),
    ],
  },
  {
    id: 'discard',
    mode: 'solo',
    title: 'recovery_challenges.discardThisExperiment',
    instruction: 'recovery_challenges.discardTheUnstagedCourtyardEditUsingRestore',
    scene: 'snapshot',
    commands: ['git diff', 'git restore event.txt'],
    hint: 'recovery_challenges.restoreWithoutStagedReplacesTheUnstagedEdit',
  },
  {
    id: 'stash-save',
    mode: 'solo',
    title: 'recovery_challenges.unfinishedWorkButYouNeedToSwitch',
    instruction: 'recovery_challenges.add1700DraftToTheProgram',
    scene: 'stash',
    commands: [
      'git add program.txt',
      'git stash push -m "Draft schedule"',
      'git stash list',
      'git stash show',
    ],
    hint: 'recovery_challenges.stashSavesTheWorkingTreeAndIndex',
    edit: [
      edit(
        'program.txt',
        program + '\n16:00 Review\n17:00 Draft',
        'recovery_challenges.addTheDraftEntry',
      ),
    ],
  },
  {
    id: 'stash-apply',
    mode: 'solo',
    title: 'recovery_challenges.switchBranchesAndReturnToYourDraft',
    instruction: 'recovery_challenges.switchToVenueThenBackToMain',
    scene: 'stash',
    commands: ['git switch venue', 'git switch main', 'git stash apply', 'git stash list'],
    hint: 'recovery_challenges.applyKeepsTheStashEntryWithoutIndex',
  },
  {
    id: 'stash-drop',
    mode: 'solo',
    title: 'recovery_challenges.yourDraftIsBackCleanUpAnd',
    instruction: 'recovery_challenges.removeTheTemporaryCopyWithStashDrop',
    scene: 'stash',
    commands: ['git stash drop', 'git add program.txt', 'git commit -m "Finish draft"'],
    hint: 'recovery_challenges.dropRemovesOnlyTheStashEntryCommit',
  },
  {
    id: 'stash-pop',
    mode: 'solo',
    title: 'recovery_challenges.restoreADraftAndRemoveItsCopy',
    instruction: 'recovery_challenges.add1800DemoAndSaveStash',
    scene: 'stash',
    commands: [
      'git stash push -m "Demo draft"',
      'git stash pop',
      'git add program.txt',
      'git commit -m "Add demo"',
    ],
    hint: 'recovery_challenges.onSuccessPopAppliesAndThenDrops',
    edit: [
      edit(
        'program.txt',
        program + '\n16:00 Review\n17:00 Draft\n18:00 Demo',
        'recovery_challenges.addTheDemoEntry',
      ),
    ],
  },
  {
    id: 'stash-conflict',
    mode: 'solo',
    title: 'recovery_challenges.evenADraftCanConflict',
    instruction: 'recovery_challenges.changeAuditoriumToCourtyardSaveAndStash',
    scene: 'stash',
    commands: [
      'git stash push -m "Courtyard draft"',
      'git add event.txt',
      'git commit -m "Choose studio"',
      'git stash pop',
    ],
    hint: 'recovery_challenges.stashCourtyardFirstThenCommitStudioAfter',
    edit: [
      edit('event.txt', 'Courtyard', 'recovery_challenges.draftCourtyard', 'Auditorium'),
      edit('event.txt', 'Studio', 'recovery_challenges.newDecisionStudio', 'Auditorium'),
    ],
  },
  {
    id: 'stash-resolve',
    mode: 'solo',
    title: 'recovery_challenges.resolveTheDraftConflictWithoutLosingIt',
    instruction: 'recovery_challenges.removeTheMarkersInEventTxtKeeping',
    scene: 'stash',
    commands: ['git add event.txt', 'git commit -m "Keep courtyard"', 'git stash drop'],
    hint: 'recovery_challenges.thisIsAStashApplicationConflictNot',
  },
  {
    id: 'shared-error',
    mode: 'team',
    title: 'recovery_challenges.theMistakeHasAlreadyReachedTheTeam',
    instruction: 'recovery_challenges.replaceCourtyardWithCancelledCommitAndPush',
    scene: 'remote',
    commands: ['git add event.txt', 'git commit -m "Cancel venue by mistake"', 'git push'],
    hint: 'recovery_challenges.theMistakeIsNowPublishedNextWe',
    edit: [
      edit(
        'event.txt',
        'Cancelled',
        'recovery_challenges.publishAnExperimentalMistake',
        'Courtyard',
      ),
    ],
  },
  {
    id: 'revert',
    mode: 'team',
    title: 'recovery_challenges.correctPublishedWorkWithoutRewritingHistory',
    instruction: 'recovery_challenges.runRevertHeadThenPushTheIncorrect',
    scene: 'recovery',
    commands: ['git revert HEAD', 'git log --oneline --graph', 'git push'],
    hint: 'recovery_challenges.revertRecordsTheInverseChangeInA',
  },
  {
    id: 'team-diverge',
    mode: 'team',
    title: 'recovery_challenges.yourTeammateReachedTheRemoteFirst',
    instruction: 'recovery_challenges.aTeammateAdded1900TeamReview',
    scene: 'remote',
    commands: ['git add event.txt', 'git commit -m "Local time update"', 'git push'],
    hint: 'recovery_challenges.theRejectionProtectsYourTeammateSChange',
    edit: [edit('event.txt', '14:00', 'recovery_challenges.changeTheTimeTo1400', '13:00')],
  },
  {
    id: 'team-sync',
    mode: 'team',
    title: 'recovery_challenges.combineYourWorkWithYourTeammateS',
    instruction: 'recovery_challenges.runFetchThenTryPullFfOnly',
    scene: 'remote',
    commands: ['git fetch', 'git pull --ff-only', 'git merge origin/main', 'git push'],
    hint: 'recovery_challenges.yourTeammateChangedTheProgramAndYou',
  },
];

export function recoveryRequirements(s: BoothSession, id: string) {
  const g = s.git,
    before = s.checkpointGit,
    current = tip(g),
    prior = tip(before);
  const tree = headTree(g),
    old = headTree(before),
    head = current ? g.commits[current] : undefined;
  const did = (command: string) => s.observed.includes(command);
  const effect = (kind: string) => s.effects.includes(kind);
  const goal = (label: string, done: unknown) => ({ label, done: Boolean(done) });
  const fresh = current !== prior;
  switch (id) {
    case 'abort':
      return [
        goal(
          'recovery_challenges.theMergeIsAbortedAndHeadStays',
          effect('merge-aborted') && !g.merging && current === prior,
        ),
        goal(
          'recovery_challenges.mainFilesAreRestoredAndTimeIs',
          clean(g) &&
            tree['event.txt']?.includes('14:00') &&
            g.branches['time'] === before.branches['time'],
        ),
      ];
    case 'retry-merge':
      return [
        goal(
          'recovery_challenges.theEventTxtConflictReturnsBetweenThe',
          g.merging?.branch === 'time' && g.merging.unresolved.includes('event.txt'),
        ),
      ];
    case 'local-error':
      return [
        goal(
          'recovery_challenges.wrongIsCommittedOnlyLocally',
          fresh &&
            tree['program.txt']?.includes('16:00 Wrong') &&
            g.remote?.branches['main'] !== current &&
            clean(g),
        ),
      ];
    case 'amend':
      return [
        goal(
          'recovery_challenges.headIsReplacedWithThePreviousCommit',
          effect('amended') &&
            fresh &&
            JSON.stringify(head?.parents) ===
              JSON.stringify(prior ? before.commits[prior].parents : []),
        ),
        goal(
          'recovery_challenges.reviewIsCommittedInsteadOfWrong',
          tree['program.txt']?.includes('16:00 Review') &&
            !tree['program.txt']?.includes('Wrong') &&
            clean(g),
        ),
      ];
    case 'soft-reset':
      return [
        goal(
          'recovery_challenges.theBranchMovesToItsParentAnd',
          effect('reset-soft') &&
            current === (prior ? before.commits[prior].parents[0] : null) &&
            !!g.commits[prior ?? ''],
        ),
        goal(
          'recovery_challenges.reviewStaysInTheWorkingFilesAnd',
          g.index['program.txt'] === old['program.txt'] &&
            g.working['program.txt'] === old['program.txt'] &&
            changed(tree, g.index).length > 0,
        ),
      ];
    case 'recommit':
      return [
        goal(
          'recovery_challenges.aNewCommitSavesReviewFromStaging',
          fresh && tree['program.txt']?.includes('16:00 Review') && clean(g),
        ),
      ];
    case 'unstage':
      return [
        goal(
          'recovery_challenges.stageTheFileThenUnstageIt',
          effect('staged') && effect('unstaged'),
        ),
        goal(
          'recovery_challenges.courtyardIsOnlyInTheWorkingFile',
          g.working['event.txt']?.includes('Courtyard') &&
            g.index['event.txt'] === tree['event.txt'] &&
            current === prior,
        ),
      ];
    case 'discard':
      return [
        goal(
          'recovery_challenges.theFileReturnsToTheIndexWithout',
          effect('restored') && clean(g) && current === prior,
        ),
      ];
    case 'stash-save':
      return [
        goal(
          'recovery_challenges.draftAndItsStagedStateAreSaved',
          g.stashes[0]?.working['program.txt']?.includes('17:00 Draft') &&
            g.stashes[0]?.index['program.txt']?.includes('17:00 Draft'),
        ),
        goal('recovery_challenges.filesAreCleanAndHeadIsUnchanged', clean(g) && current === prior),
      ];
    case 'stash-apply':
      return [
        goal(
          'recovery_challenges.switchToVenueThenReturnToMain',
          did('git switch venue') && did('git switch main') && g.head === 'main',
        ),
        goal(
          'recovery_challenges.draftReturnsUnstagedAndTheStashRemains',
          effect('stash-applied') &&
            g.working['program.txt']?.includes('17:00 Draft') &&
            !g.index['program.txt']?.includes('17:00 Draft') &&
            g.stashes.length === 1 &&
            current === prior,
        ),
      ];
    case 'stash-drop':
      return [
        goal(
          'recovery_challenges.dropTheTemporaryCopyAndCommitDraft',
          effect('stash-dropped') &&
            !g.stashes.length &&
            fresh &&
            tree['program.txt']?.includes('17:00 Draft') &&
            clean(g),
        ),
      ];
    case 'stash-pop':
      return [
        goal(
          'recovery_challenges.stashTheDraftThenSuccessfullyRestoreIt',
          effect('stashed') && effect('stash-popped') && !g.stashes.length,
        ),
        goal(
          'recovery_challenges.demoIsSavedInANewCommit',
          fresh && tree['program.txt']?.includes('18:00 Demo') && clean(g),
        ),
      ];
    case 'stash-conflict':
      return [
        goal(
          'recovery_challenges.popRevealsAConflictAndTheCourtyard',
          effect('stash-conflict') &&
            g.stashConflicts.includes('event.txt') &&
            g.stashes[0]?.working['event.txt']?.includes('Courtyard'),
        ),
        goal(
          'recovery_challenges.theStudioDecisionIsStillSavedIn',
          tree['event.txt']?.includes('Studio'),
        ),
      ];
    case 'stash-resolve':
      return [
        goal(
          'recovery_challenges.courtyardAnd1300AreCommittedWithout',
          fresh &&
            tree['event.txt']?.includes('Venue: Courtyard') &&
            tree['event.txt']?.includes('Time: 13:00') &&
            !g.stashConflicts.length &&
            clean(g),
        ),
        goal(
          'recovery_challenges.theCommitHasOneParentAndThe',
          head?.parents.length === 1 && !g.stashes.length,
        ),
      ];
    case 'shared-error':
      return [
        goal(
          'recovery_challenges.cancelledIsCommittedOnBothMachines',
          fresh &&
            tree['event.txt']?.includes('Cancelled') &&
            g.remote?.branches['main'] === current &&
            clean(g),
        ),
      ];
    case 'revert':
      return [
        goal(
          'recovery_challenges.aNewInverseCommitKeepsTheMistake',
          effect('reverted') &&
            fresh &&
            head?.parents[0] === prior &&
            tree['event.txt']?.includes('Courtyard'),
        ),
        goal(
          'recovery_challenges.theCorrectionReachesTheTeam',
          g.remote?.branches['main'] === current && clean(g),
        ),
      ];
    case 'team-diverge':
      return [
        goal(
          'recovery_challenges.1400IsCommittedLocallyWhileThe',
          fresh && tree['event.txt']?.includes('14:00') && g.remote?.branches['main'] === 'r002',
        ),
        goal('recovery_challenges.pushIsRejectedToProtectTheTeammate', effect('push-rejected')),
      ];
    case 'team-sync':
      return [
        goal('recovery_challenges.observeThatFastForwardIsNotEnough', effect('ff-rejected')),
        goal(
          'recovery_challenges.mergeBothChangesWithTwoParents',
          fresh &&
            head?.parents.length === 2 &&
            tree['event.txt']?.includes('14:00') &&
            tree['program.txt']?.includes('19:00 Team review'),
        ),
        goal(
          'recovery_challenges.bothMachinesAreSynchronizedWithoutForcePush',
          g.remote?.branches['main'] === current && clean(g),
        ),
      ];
    default:
      return undefined;
  }
}
