export const commandReference = [
  [
    'ابدأ وافحص',
    'git init · git status · git diff · git log --oneline --graph',
    'ملفات العمل ← منطقة التجهيز (index) ← لقطة محفوظة (commit). تعديل الملف لا يغيّر التاريخ تلقائيًا.',
  ],
  [
    'احفظ لقطة',
    'git add .\ngit commit -m "Describe the change"',
    'أمر add يجهّز النسخة الحالية. أمر commit يحفظ ما في منطقة التجهيز، حتى لو عدّلت الملف بعد add.',
  ],
  [
    'تفرّع وادمج',
    'git switch -c venue\ngit switch main\ngit merge venue',
    'الفرع مؤشّر إلى commit. عند التعارض عدّل النص واحذف العلامات، ثم add وcommit. لإلغاء دمج جارٍ استخدم git merge --abort.',
  ],
  [
    'احفظ المسودة',
    'git stash push -m "Draft"\ngit stash apply\ngit stash pop',
    'apply يحتفظ بالمدخلة، وpop يحذفها عند النجاح. عند التعارض تبقى المدخلة حتى تحلّه وتحذفها بنفسك.',
  ],
  [
    'تبادل العمل',
    'git fetch\ngit pull --ff-only\ngit push',
    'fetch يحدّث معرفتك بالبعيد دون تعديل ملفاتك. pull --ff-only يرفض التاريخ المتفرّع. كل الشبكة هنا محاكاة.',
  ],
  [
    'صحّح بأمان',
    'git commit --amend -m "Correction"\ngit reset --soft HEAD~1\ngit revert HEAD',
    'amend وreset للتاريخ المحلي غير المنشور في هذا المختبر. استخدم revert لإنشاء تصحيح جديد لتغيير منشور.',
  ],
];
