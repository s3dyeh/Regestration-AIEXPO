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
  edit?: { file: string; find?: string; value: string; label: string }[];
}
const venue = (find: string, value: string) => ({
  file: 'event.txt',
  find,
  value,
  label: `غيّر المكان إلى ${value}`,
});
const time = (find: string, value: string) => ({
  file: 'event.txt',
  find,
  value,
  label: `غيّر الوقت إلى ${value}`,
});
export const challenges: Challenge[] = [
  {
    id: 'problem',
    title: 'تعديلان. ملف واحد. ماذا سيضيع؟',
    instruction: 'استبدل الملف بإحدى النسختين، ثم أنشئ مستودعًا يحفظ التغييرات.',
    scene: 'collision',
    commands: ['git init', 'git status'],
    hint: 'استبدال ملف كامل قد يمسح تعديلًا آخر. git init يبدأ قاعدة التاريخ، ولا يحفظ نسخة بعد.',
  },
  {
    id: 'first',
    title: 'أنشئ أول نقطة آمنة',
    instruction: 'جهّز الملفين، ثم احفظ أول snapshot. شاهد المحتوى ينتقل بين المراحل.',
    scene: 'snapshot',
    commands: ['git status', 'git add .', 'git diff --staged', 'git commit -m "First snapshot"'],
    hint: 'add يجهّز المحتوى. commit يحفظ المحتوى المجهّز فقط. استخدم git add . لتجهيز الملفين.',
  },
  {
    id: 'staging',
    title: 'هل الحفظ يأخذ آخر تعديل؟',
    instruction:
      'غيّر Room A إلى Auditorium واحفظ الملف وجهّزه. بعدها غيّر Auditorium إلى Library واحفظ الملف دون add. توقّع ثم نفّذ commit.',
    scene: 'snapshot',
    commands: [
      'git add event.txt',
      'git diff',
      'git diff --staged',
      'git commit -m "Staged venue"',
    ],
    hint: 'الترتيب مهم: Auditorium ← حفظ الملف ← add ← Library ← حفظ الملف ← commit. إن اختلط الترتيب، أعد هذا التحدّي.',
    edit: [venue('Room A', 'Auditorium'), venue('Auditorium', 'Library')],
  },
  {
    id: 'save',
    title: 'احفظ التعديل المتبقي',
    instruction: 'Library موجودة في ملفات العمل فقط. قارن الفرق ثم جهّزها واحفظها.',
    scene: 'snapshot',
    commands: [
      'git diff',
      'git add .',
      'git commit -m "Save library"',
      'git log --oneline --graph',
    ],
    hint: 'نحتاج add جديدًا للمحتوى الجديد. التاريخ السابق سيبقى كما هو.',
  },
  {
    id: 'branch',
    title: 'افتح مسارًا لتجربة تغيير',
    instruction: 'أنشئ فرع venue وانتقل إليه. غيّر Library إلى Auditorium، ثم جهّز التغيير واحفظه.',
    scene: 'graph',
    commands: [
      'git switch -c venue',
      'git branch',
      'git add .',
      'git commit -m "Venue experiment"',
    ],
    hint: 'ابدأ بـ switch -c قبل التعديل. راقب HEAD وvenue يتحركان بينما main يبقى في مكانه.',
    edit: [venue('Library', 'Auditorium')],
  },
  {
    id: 'merge',
    title: 'اجمع تعديلين دون أن تفقد أحدهما',
    instruction: 'ارجع إلى main. أضف 13:00 Workshop إلى program.txt واحفظ commit، ثم ادمج venue.',
    scene: 'graph',
    commands: ['git switch main', 'git add .', 'git commit -m "Add workshop"', 'git merge venue'],
    hint: 'على main ستعود Library. بعد حفظ البرنامج ودمج venue ستجتمع Auditorium وWorkshop في commit بأبوين.',
    edit: [
      {
        file: 'program.txt',
        value: '10:00 Welcome\n11:00 Git booth\n13:00 Workshop',
        label: 'أضف Workshop إلى البرنامج',
      },
    ],
  },
  {
    id: 'time-branch',
    title: 'جرّب موعدًا مختلفًا',
    instruction: 'أنشئ فرع time، غيّر الوقت من 10:00 إلى 12:00، ثم جهّزه واحفظ commit.',
    scene: 'graph',
    commands: ['git switch -c time', 'git add .', 'git commit -m "Time at noon"'],
    hint: 'هذا التعديل مستقل عن main. سنغيّر نفس السطر هناك في الخطوة التالية.',
    edit: [time('10:00', '12:00')],
  },
  {
    id: 'collision',
    title: 'غيّر نفس السطر في المسار الآخر',
    instruction:
      'ارجع إلى main، غيّر 10:00 إلى 14:00 واحفظ commit. جرّب دمج time. هل يختار Git بدلًا منك؟',
    scene: 'conflict',
    commands: ['git switch main', 'git add .', 'git commit -m "Time at two"', 'git merge time'],
    hint: 'بعد حفظ الموعدين على فرعين مختلفين، merge يعرض التعارض ويحفظ النسختين.',
    edit: [time('10:00', '14:00')],
  },
  ...mergeRecoveryChallenges,
  {
    id: 'resolve',
    title: 'أنت تقرّر. Git يحفظ القرار.',
    instruction:
      'احذف علامات التعارض من event.txt واختر Time: 13:00. احفظ الملف ثم add وcommit لإتمام الدمج.',
    scene: 'conflict',
    commands: ['git status', 'git add event.txt', 'git commit -m "Agree on time"'],
    hint: 'احتفظ بسطر المكان وسطر الفعالية، وأبقِ سطر وقت واحدًا. احذف <<<<<<< و======= و>>>>>>>.',
  },
  {
    id: 'push',
    title: 'هل وصل تاريخك إلى الجهاز الآخر؟',
    instruction: 'وصلنا مستودعًا بعيدًا فارغًا داخل المحاكاة. افحص الوجهة ثم ارفع تاريخ main إليه.',
    scene: 'remote',
    commands: ['git remote -v', 'git push'],
    hint: 'commit محلي. push ينقل التاريخ ومحتواه إلى origin؛ لا يوجد اتصال إنترنت حقيقي.',
  },
  {
    id: 'fetch',
    title: 'اجلب التغيير… دون لمس ملفاتك',
    instruction:
      'المستودع البعيد أضاف 15:00 Testing. استخدم fetch وحده. راقب origin/main يسبق main.',
    scene: 'remote',
    commands: ['git fetch', 'git status'],
    hint: 'fetch يحدّث معرفتك بالبعيد. لا تنفّذ pull بعد؛ المطلوب إبقاء ملفك دون Testing.',
  },
  {
    id: 'pull',
    title: 'حرّك فرعك إلى التاريخ الجديد',
    instruction: 'التاريخ موجود محليًا الآن. حدّث main والملفات دون إنشاء merge commit.',
    scene: 'remote',
    commands: ['git pull --ff-only', 'git log --oneline --graph'],
    hint: 'pull --ff-only ينجح عندما يمكن تحريك الفرع إلى الأمام دون دمج تاريخين متفرعين.',
  },
  ...recoveryChallenges,
  {
    id: 'finish',
    title: 'هذا تاريخ صنعته بأوامرك.',
    instruction:
      'من ملف قابل للاستبدال إلى snapshots وفروع ودمج وتاريخ مشترك. جاهزون للمجموعة التالية؟',
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
        goal('جرّب استبدال إحدى النسختين', s.introChoice),
        goal('أنشئ المستودع المحلي', g.initialized),
      ];
    case 'first':
      return [
        goal('الملفان داخل أول commit', tree['event.txt'] && tree['program.txt']),
        goal('ملفات العمل محفوظة بالكامل', clean(g)),
      ];
    case 'staging':
      return [
        goal('توقّع محتوى الـcommit من نسخة الـindex', s.prediction === 'Auditorium'),
        goal('الـcommit يحفظ Auditorium', newCommit && saved.includes('Auditorium')),
        goal('ملف العمل يحتفظ بـLibrary', working.includes('Library')),
      ];
    case 'save':
      return [
        goal('قارن التعديل غير المجهّز', did('git diff')),
        goal(
          'Library محفوظة ولا تعديلات متبقية',
          newCommit && saved.includes('Library') && clean(g),
        ),
      ];
    case 'branch':
      return [
        goal(
          'HEAD على venue، وmain بقي مكانه',
          g.head === 'venue' && g.branches['main'] === s.checkpointGit.branches['main'],
        ),
        goal(
          'احفظ Auditorium على الفرع الجديد',
          saved.includes('Auditorium') && newCommit && clean(g),
        ),
      ];
    case 'merge':
      return [
        goal(
          'ادمج المسارين على main بأبوين',
          g.head === 'main' && g.commits[tip(g) ?? '']?.parents.length === 2,
        ),
        goal(
          'احفظ تغيير المكان والبرنامج معًا',
          saved.includes('Auditorium') && tree['program.txt']?.includes('Workshop') && clean(g),
        ),
      ];
    case 'time-branch':
      return [
        goal(
          'احفظ 12:00 على time، دون تحريك main',
          g.head === 'time' &&
            saved.includes('Time: 12:00') &&
            g.branches['main'] === s.checkpointGit.branches['main'] &&
            clean(g),
        ),
      ];
    case 'collision':
      return [
        goal('main يحفظ 14:00', g.head === 'main' && saved.includes('Time: 14:00')),
        goal(
          'الدمج يكشف تعارضًا في event.txt',
          g.merging?.branch === 'time' && g.merging.unresolved.includes('event.txt'),
        ),
      ];
    case 'resolve':
      return [
        goal(
          'احفظ قرار 13:00 دون علامات تعارض',
          saved.includes('Time: 13:00') &&
            saved.includes('Venue: Auditorium') &&
            saved.includes('Event: Campus Code Day') &&
            !/^(<<<<<<<|=======|>>>>>>>)/m.test(saved),
        ),
        goal(
          'أنهِ الدمج بـcommit له أبوان',
          !g.merging && newCommit && g.commits[tip(g) ?? '']?.parents.length === 2 && clean(g),
        ),
      ];
    case 'push':
      return [
        goal('افحص عنوان origin', did('git remote -v')),
        goal('main البعيد يطابق main المحلي', tip(g) && g.remote?.branches['main'] === tip(g)),
      ];
    case 'fetch':
      return [
        goal('origin/main يعرف التغيير الجديد', g.tracking['main'] === 'r001'),
        goal(
          'main وملفاتك لم يتغيّرا',
          tip(g) === tip(s.checkpointGit) && !g.working['program.txt']?.includes('Testing'),
        ),
      ];
    case 'pull':
      return [
        goal('main وصل إلى r001 دون merge commit', tip(g) === 'r001'),
        goal(
          'Testing وصلت إلى ملف البرنامج',
          g.working['program.txt']?.includes('Testing') && clean(g),
        ),
      ];
    default:
      return [];
  }
}
