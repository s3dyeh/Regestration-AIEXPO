import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { GitLearningStore } from '../state/git-learning.store';
@Component({
  selector: 'app-learning-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div id="editor">
      <label class="file-picker"
        >الملف
        <select
          id="file-select"
          aria-label="اختر ملف المشروع"
          [value]="store.session().selectedFile"
          (change)="selectFile($event)"
        >
          @for (file of store.files(); track file) {
            <option [value]="file">{{ file }}</option>
          }
        </select></label
      >
      <textarea
        id="file-content"
        dir="ltr"
        spellcheck="false"
        [attr.aria-label]="'محتوى الملف ' + store.session().selectedFile"
        [value]="store.editorContent()"
        (input)="edit($event)"
        (keydown)="shortcut($event)"
      ></textarea>
      <div class="editor-bottom">
        <span id="editor-status">{{
          store.editorDirty() ? 'مسودة غير محفوظة — اضغط حفظ الملف' : 'المحرر يغيّر ملفات العمل فقط'
        }}</span
        ><button
          class="button secondary small"
          data-action="save-file"
          (click)="store.dispatch({ type: 'editor/save' })"
        >
          حفظ الملف
        </button>
      </div>
    </div>
  `,
})
export class LearningEditorComponent {
  protected readonly store = inject(GitLearningStore);
  protected selectFile(event: Event): void {
    this.store.dispatch({ type: 'editor/select', file: (event.target as HTMLSelectElement).value });
  }
  protected edit(event: Event): void {
    this.store.dispatch({
      type: 'editor/draft',
      content: (event.target as HTMLTextAreaElement).value,
    });
  }
  protected shortcut(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      this.store.dispatch({ type: 'editor/save' });
    }
  }
}
