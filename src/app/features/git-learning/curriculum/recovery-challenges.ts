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
    title: 'مش جاهز للقرار؟ ألغِ الدمج.',
    instruction:
      'الدمج ما زال جاريًا. نفّذ merge --abort وأثبت أن ملفات main عادت إلى 14:00 وأن فرع time ما زال يحفظ 12:00.',
    scene: 'recovery',
    commands: ['git status', 'git merge --abort'],
    hint: 'abort يلغي العملية الجارية فقط. لا يحذف أي فرع أو commit. بدأت هذه المحاكاة الدمج من ملفات نظيفة.',
  },
  {
    id: 'retry-merge',
    mode: 'team',
    title: 'أعد المحاولة، ثم احسم التعارض',
    instruction: 'ابدأ دمج time مجددًا. ستعود علامات التعارض لأن تعديلَي الفرعين ما زالا موجودين.',
    scene: 'conflict',
    commands: ['git merge time'],
    hint: 'إلغاء الدمج ليس حذفًا لأحد المسارين. في الخطوة التالية ستختار الحل وتكمل الدمج.',
  },
];
export const recoveryChallenges: Challenge[] = [
  {
    id: 'local-error',
    mode: 'solo',
    title: 'عملت commit بالغلط… ولسّه محلي.',
    instruction:
      'أضف 16:00 Wrong إلى program.txt واحفظ commit دون push. هذه نسخة خاطئة لم تصل لأي زميل.',
    scene: 'recovery',
    commands: ['git add program.txt', 'git commit -m "Wrong session"'],
    hint: 'المحاكاة تقارن HEAD المحلي بالبعيد. هذا التغيير لم يُنشر؛ سنصححه قبل المشاركة.',
    edit: [edit('program.txt', program + '\n16:00 Wrong', 'أضف فقرة خاطئة')],
  },
  {
    id: 'amend',
    mode: 'solo',
    title: 'صحّح آخر commit قبل مشاركته',
    instruction:
      'بدّل Wrong إلى Review واحفظ الملف وجهّزه، ثم استخدم commit --amend. راقب المعرّف القديم والجديد والآباء.',
    scene: 'recovery',
    commands: ['git add program.txt', 'git commit --amend -m "Review session"'],
    hint: 'amend يصنع commit بديلًا؛ لا يعدّل الكائن القديم. في هذا المختبر نمنع تعديل commit منشور لحماية تاريخ الفريق.',
    edit: [edit('program.txt', 'Review', 'صحّح Wrong إلى Review', 'Wrong')],
  },
  {
    id: 'soft-reset',
    mode: 'solo',
    title: 'ألغِ الـcommit، واحتفظ بالشغل',
    instruction:
      'استخدم reset --soft HEAD~1. يجب أن يرجع الفرع فقط، وتبقى Review في ملفات العمل والـindex.',
    scene: 'recovery',
    commands: ['git reset --soft HEAD~1', 'git diff --staged'],
    hint: 'soft يحرك HEAD، ولا يمس الملفات أو التجهيز. لا نستخدم reset --hard في هذا المختبر.',
  },
  {
    id: 'recommit',
    mode: 'solo',
    title: 'احفظ التعديل من جديد',
    instruction: 'التعديل ما زال مجهّزًا. نفّذ commit برسالة واضحة، دون إعادة كتابة الملف.',
    scene: 'recovery',
    commands: ['git diff --staged', 'git commit -m "Reviewed schedule"'],
    hint: 'بعد soft reset المحتوى جاهز للحفظ؛ لا تحتاج add إذا لم تغيّر الـindex.',
  },
  {
    id: 'unstage',
    mode: 'solo',
    title: 'جهّزت ملفًا بالغلط؟',
    instruction:
      'غيّر Auditorium إلى Courtyard واحفظ الملف. نفّذ add، ثم restore --staged event.txt. يجب أن يبقى التعديل في العمل فقط.',
    scene: 'snapshot',
    commands: ['git add event.txt', 'git restore --staged event.txt', 'git diff'],
    hint: 'restore --staged يلغي التجهيز؛ لا يلغي تعديل الملف ولا ينشئ commit.',
    edit: [edit('event.txt', 'Courtyard', 'غيّر المكان إلى Courtyard', 'Auditorium')],
  },
  {
    id: 'discard',
    mode: 'solo',
    title: 'هذه التجربة لا نريد حفظها',
    instruction:
      'ألغِ تعديل Courtyard غير المجهّز باستخدام restore event.txt. راقب رجوع الملف إلى محتوى الـindex دون تغيير التاريخ.',
    scene: 'snapshot',
    commands: ['git diff', 'git restore event.txt'],
    hint: 'restore بدون --staged يستبدل التعديل غير المجهّز. هنا ستتخلّى عن هذه التجربة تحديدًا.',
  },
  {
    id: 'stash-save',
    mode: 'solo',
    title: 'شغلك مش جاهز… وبدك تبدّل فرع',
    instruction:
      'أضف 17:00 Draft إلى البرنامج واحفظ الملف وجهّزه. خزّنه مؤقتًا باستخدام stash push. راقب درج المسودات وعودة الملفات إلى HEAD.',
    scene: 'stash',
    commands: [
      'git add program.txt',
      'git stash push -m "Draft schedule"',
      'git stash list',
      'git stash show',
    ],
    hint: 'stash يحفظ العمل والـindex محليًا دون commit على الفرع. الملفات غير المتتبعة لا تُحفظ افتراضيًا.',
    edit: [edit('program.txt', program + '\n16:00 Review\n17:00 Draft', 'أضف مسودة Draft')],
  },
  {
    id: 'stash-apply',
    mode: 'solo',
    title: 'غيّر الفرع وارجع لمسودتك',
    instruction:
      'انتقل إلى venue ثم ارجع إلى main. استخدم stash apply. راقب عودة Draft وبقاء النسخة في الدرج، دون تحريك HEAD.',
    scene: 'stash',
    commands: ['git switch venue', 'git switch main', 'git stash apply', 'git stash list'],
    hint: 'apply يبقي النسخة في stash. دون --index يعود التعديل غير مجهّز، حتى لو جهّزته قبل التخزين.',
  },
  {
    id: 'stash-drop',
    mode: 'solo',
    title: 'نسختك رجعت. نظّف الدرج واحفظها.',
    instruction:
      'احذف النسخة المؤقتة باستخدام stash drop، ثم جهّز Draft واحفظ commit. حذف الـstash لا يحذف الملف المستعاد.',
    scene: 'stash',
    commands: ['git stash drop', 'git add program.txt', 'git commit -m "Finish draft"'],
    hint: 'drop يحذف مدخل stash فقط. احفظ العمل المستعاد قبل الانتقال إلى تجربة جديدة.',
  },
  {
    id: 'stash-pop',
    mode: 'solo',
    title: 'استرجع المسودة واحذف نسختها بخطوة',
    instruction:
      'أضف 18:00 Demo واحفظ الملف. خزّنه في stash ثم استرجعه بـpop. بعد نجاح الاسترجاع جهّز التعديل واحفظه.',
    scene: 'stash',
    commands: [
      'git stash push -m "Demo draft"',
      'git stash pop',
      'git add program.txt',
      'git commit -m "Add demo"',
    ],
    hint: 'عند النجاح: pop = تطبيق ثم حذف النسخة. إذا حدث تعارض تبقى النسخة محفوظة.',
    edit: [
      edit('program.txt', program + '\n16:00 Review\n17:00 Draft\n18:00 Demo', 'أضف مسودة Demo'),
    ],
  },
  {
    id: 'stash-conflict',
    mode: 'solo',
    title: 'حتى المسودة قد تتعارض',
    instruction:
      'غيّر Auditorium إلى Courtyard واحفظ ثم stash. غيّر الملف الحالي إلى Studio واحفظ commit. الآن جرّب stash pop: نفس السطر يحمل قرارين.',
    scene: 'stash',
    commands: [
      'git stash push -m "Courtyard draft"',
      'git add event.txt',
      'git commit -m "Choose studio"',
      'git stash pop',
    ],
    hint: 'خزّن Courtyard أولًا، ثم احفظ Studio في التاريخ. بعد pop المتعارض ستبقى النسخة في درج stash.',
    edit: [
      edit('event.txt', 'Courtyard', 'مسودة Courtyard', 'Auditorium'),
      edit('event.txt', 'Studio', 'قرار جديد: Studio', 'Auditorium'),
    ],
  },
  {
    id: 'stash-resolve',
    mode: 'solo',
    title: 'حل تعارض المسودة دون فقدها',
    instruction:
      'في event.txt احذف العلامات واحتفظ بالمكان Courtyard والوقت 13:00. احفظ، ثم add وcommit، ثم احذف النسخة القديمة بـstash drop.',
    scene: 'stash',
    commands: ['git add event.txt', 'git commit -m "Keep courtyard"', 'git stash drop'],
    hint: 'هذا تعارض تطبيق stash، وليس دمج فرعين؛ الـcommit الجديد له أب واحد. add يعلّم الملف بأنه محلول.',
  },
  {
    id: 'shared-error',
    mode: 'team',
    title: 'الخطأ وصل للفريق بالفعل',
    instruction:
      'بدّل Courtyard إلى Cancelled، واحفظ commit ثم push. راقب الجهازين يعرضان الخطأ نفسه.',
    scene: 'remote',
    commands: ['git add event.txt', 'git commit -m "Cancel venue by mistake"', 'git push'],
    hint: 'الآن الخطأ منشور. في الخطوة التالية سنعكسه دون حذف التاريخ الذي قد يعتمد عليه زميل.',
    edit: [edit('event.txt', 'Cancelled', 'انشر خطأ تجريبيًا', 'Courtyard')],
  },
  {
    id: 'revert',
    mode: 'team',
    title: 'صحّح المنشور دون إعادة كتابة التاريخ',
    instruction: 'نفّذ revert HEAD، ثم push. يبقى commit الخاطئ، ويضاف بعده commit يعيد Courtyard.',
    scene: 'recovery',
    commands: ['git revert HEAD', 'git log --oneline --graph', 'git push'],
    hint: 'revert يسجل عكس التغيير في commit جديد. المختبر يدعم HEAD ذا الأب الواحد؛ عكس merge commit يحتاج اختيار mainline وهو خارج هذا التدريب.',
  },
  {
    id: 'team-diverge',
    mode: 'team',
    title: 'زميلك سبقك إلى المستودع البعيد',
    instruction:
      'زميل أضاف 19:00 Team review بعيدًا. غيّر الوقت محليًا من 13:00 إلى 14:00 واحفظ commit، ثم جرّب push. لماذا يُرفض؟',
    scene: 'remote',
    commands: ['git add event.txt', 'git commit -m "Local time update"', 'git push'],
    hint: 'الرفض يحمي تعديل الزميل. لا نحتاج force push؛ سنجلب التاريخ ونجمع المسارين.',
    edit: [edit('event.txt', '14:00', 'غيّر الوقت إلى 14:00', '13:00')],
  },
  {
    id: 'team-sync',
    mode: 'team',
    title: 'اجمع شغلك وشغل زميلك',
    instruction:
      'نفّذ fetch، ثم جرّب pull --ff-only وشاهد رفضه لتفرّع التاريخ. ادمج origin/main صراحةً ثم push.',
    scene: 'remote',
    commands: ['git fetch', 'git pull --ff-only', 'git merge origin/main', 'git push'],
    hint: 'الزميل عدّل البرنامج وأنت عدّلت الوقت؛ الدمج يجمعهما. commit الدمج له أبوان، وpush ينجح بعد أن يحتوي تاريخك عمل الزميل.',
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
          'أُلغي الدمج، وبقي HEAD مكانه',
          effect('merge-aborted') && !g.merging && current === prior,
        ),
        goal(
          'ملفات main عادت وبقي time محفوظًا',
          clean(g) &&
            tree['event.txt']?.includes('14:00') &&
            g.branches['time'] === before.branches['time'],
        ),
      ];
    case 'retry-merge':
      return [
        goal(
          'عاد تعارض event.txt بين نفس الفرعين',
          g.merging?.branch === 'time' && g.merging.unresolved.includes('event.txt'),
        ),
      ];
    case 'local-error':
      return [
        goal(
          'Wrong محفوظة محليًا فقط',
          fresh &&
            tree['program.txt']?.includes('16:00 Wrong') &&
            g.remote?.branches['main'] !== current &&
            clean(g),
        ),
      ];
    case 'amend':
      return [
        goal(
          'استُبدل HEAD بآباء النسخة السابقة',
          effect('amended') &&
            fresh &&
            JSON.stringify(head?.parents) ===
              JSON.stringify(prior ? before.commits[prior].parents : []),
        ),
        goal(
          'Review محفوظة بدل Wrong',
          tree['program.txt']?.includes('16:00 Review') &&
            !tree['program.txt']?.includes('Wrong') &&
            clean(g),
        ),
      ];
    case 'soft-reset':
      return [
        goal(
          'رجع الفرع إلى الأب وبقي الـcommit القديم محفوظًا',
          effect('reset-soft') &&
            current === (prior ? before.commits[prior].parents[0] : null) &&
            !!g.commits[prior ?? ''],
        ),
        goal(
          'Review بقيت في الملفات والـindex',
          g.index['program.txt'] === old['program.txt'] &&
            g.working['program.txt'] === old['program.txt'] &&
            changed(tree, g.index).length > 0,
        ),
      ];
    case 'recommit':
      return [
        goal(
          'commit جديد يحفظ Review من التجهيز',
          fresh && tree['program.txt']?.includes('16:00 Review') && clean(g),
        ),
      ];
    case 'unstage':
      return [
        goal('جهّزت الملف ثم ألغيت التجهيز', effect('staged') && effect('unstaged')),
        goal(
          'Courtyard في العمل فقط، والتاريخ ثابت',
          g.working['event.txt']?.includes('Courtyard') &&
            g.index['event.txt'] === tree['event.txt'] &&
            current === prior,
        ),
      ];
    case 'discard':
      return [
        goal(
          'عاد الملف إلى الـindex دون commit',
          effect('restored') && clean(g) && current === prior,
        ),
      ];
    case 'stash-save':
      return [
        goal(
          'حُفظت Draft وحالة تجهيزها في درج المسودات',
          g.stashes[0]?.working['program.txt']?.includes('17:00 Draft') &&
            g.stashes[0]?.index['program.txt']?.includes('17:00 Draft'),
        ),
        goal('الملفات نظيفة وHEAD ثابت', clean(g) && current === prior),
      ];
    case 'stash-apply':
      return [
        goal(
          'بدّلت إلى venue ثم عدت إلى main',
          did('git switch venue') && did('git switch main') && g.head === 'main',
        ),
        goal(
          'عادت Draft غير مجهّزة وبقي الـstash',
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
          'حذفت النسخة المؤقتة وحفظت Draft في التاريخ',
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
          'خزّنت المسودة ثم استرجعتها بنجاح بـpop',
          effect('stashed') && effect('stash-popped') && !g.stashes.length,
        ),
        goal(
          'Demo محفوظة في commit جديد',
          fresh && tree['program.txt']?.includes('18:00 Demo') && clean(g),
        ),
      ];
    case 'stash-conflict':
      return [
        goal(
          'pop كشف تعارضًا وبقيت نسخة Courtyard',
          effect('stash-conflict') &&
            g.stashConflicts.includes('event.txt') &&
            g.stashes[0]?.working['event.txt']?.includes('Courtyard'),
        ),
        goal('قرار Studio ما زال محفوظًا في HEAD', tree['event.txt']?.includes('Studio')),
      ];
    case 'stash-resolve':
      return [
        goal(
          'Courtyard و13:00 محفوظان دون تعارض',
          fresh &&
            tree['event.txt']?.includes('Venue: Courtyard') &&
            tree['event.txt']?.includes('Time: 13:00') &&
            !g.stashConflicts.length &&
            clean(g),
        ),
        goal('الـcommit له أب واحد والدرج فارغ', head?.parents.length === 1 && !g.stashes.length),
      ];
    case 'shared-error':
      return [
        goal(
          'Cancelled محفوظة على الجهازين',
          fresh &&
            tree['event.txt']?.includes('Cancelled') &&
            g.remote?.branches['main'] === current &&
            clean(g),
        ),
      ];
    case 'revert':
      return [
        goal(
          'commit عكسي جديد يحتفظ بالخطأ كأب',
          effect('reverted') &&
            fresh &&
            head?.parents[0] === prior &&
            tree['event.txt']?.includes('Courtyard'),
        ),
        goal('وصل التصحيح إلى الفريق', g.remote?.branches['main'] === current && clean(g)),
      ];
    case 'team-diverge':
      return [
        goal(
          'حفظت 14:00 محليًا والبعيد متقدّم بمسار آخر',
          fresh && tree['event.txt']?.includes('14:00') && g.remote?.branches['main'] === 'r002',
        ),
        goal('push رُفض لحماية تعديل الزميل', effect('push-rejected')),
      ];
    case 'team-sync':
      return [
        goal('رأيت أن fast-forward لا يكفي', effect('ff-rejected')),
        goal(
          'دمجت التعديلين بأبوين',
          fresh &&
            head?.parents.length === 2 &&
            tree['event.txt']?.includes('14:00') &&
            tree['program.txt']?.includes('19:00 Team review'),
        ),
        goal(
          'الجهازان متزامنان دون force push',
          g.remote?.branches['main'] === current && clean(g),
        ),
      ];
    default:
      return undefined;
  }
}
