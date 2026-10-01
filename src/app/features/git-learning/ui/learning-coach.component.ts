import { ChangeDetectionStrategy, Component, inject, linkedSignal, output } from '@angular/core';
import { GitLearningStore } from '../state/git-learning.store';

@Component({
  selector: 'app-learning-coach',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="learning-coach" aria-label="مساعد التعلّم">
      <div class="coach-progress">
        <span
          >تقدّم المسار <strong>{{ store.progress().percent }}%</strong></span
        >
        <progress
          aria-label="التجارب المكتملة"
          [value]="store.progress().completed"
          [max]="store.progress().total"
        ></progress>
        <small>{{ store.progress().completed }} من {{ store.progress().total }} تجربة مكتملة</small>
      </div>
      @if (!store.final()) {
        <div class="coach-next">
          <small>{{ store.complete() ? 'جاهز للمتابعة' : 'الهدف التالي' }}</small>
          <p>{{ store.nextGoal() ?? 'أكملت نتائج هذه التجربة. انتقل إلى التحدّي التالي.' }}</p>
          <div class="coach-actions">
            <button type="button" (click)="navigate.emit('command-input')">
              اذهب إلى الطرفية ↓
            </button>
            @if (store.showEditor()) {
              <button type="button" (click)="navigate.emit('file-content')">
                اذهب إلى المحرر ↓
              </button>
            }
            <button
              type="button"
              [attr.aria-expanded]="hintOpen()"
              aria-controls="challenge-hint"
              (click)="hintOpen.update(toggle)"
            >
              {{ hintOpen() ? 'إخفاء التلميح' : 'أحتاج تلميحًا' }}
            </button>
          </div>
          @if (hintOpen()) {
            <div id="challenge-hint" class="coach-hint">
              <strong>فكّر قبل التنفيذ</strong>
              <p>{{ store.challenge().hint }}</p>
              <small>التلميح يشرح فقط؛ زر «حل» ينفّذ خطوة واحدة.</small>
            </div>
          }
        </div>
      }
      <dl class="repository-summary" aria-label="حالة المستودع">
        <div>
          <dt>الفرع الحالي</dt>
          <dd dir="ltr">{{ store.repositorySummary().branch }}</dd>
        </div>
        <div>
          <dt>مسودات غير محفوظة</dt>
          <dd data-summary="drafts">{{ store.repositorySummary().drafts }}</dd>
        </div>
        <div>
          <dt>ملفات غير مجهّزة</dt>
          <dd data-summary="unstaged">{{ store.repositorySummary().unstaged }}</dd>
        </div>
        <div>
          <dt>ملفات مجهّزة</dt>
          <dd data-summary="staged">{{ store.repositorySummary().staged }}</dd>
        </div>
        <div>
          <dt>كائنات commit</dt>
          <dd data-summary="commits">{{ store.repositorySummary().commits }}</dd>
        </div>
      </dl>
    </section>
  `,
})
export class LearningCoachComponent {
  protected readonly store = inject(GitLearningStore);
  readonly navigate = output<'command-input' | 'file-content'>();
  protected readonly hintOpen = linkedSignal(() => {
    this.store.checkpoint();
    return false;
  });
  protected readonly toggle = (value: boolean) => !value;
}
