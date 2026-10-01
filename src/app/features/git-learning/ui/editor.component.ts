import { TranslocoPipe } from '@jsverse/transloco';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { GitLearningStore } from '../state/git-learning.store';
@Component({
  selector: 'app-learning-editor',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div id="editor">
      <label class="file-picker"
        >{{ 'editor.file' | transloco
        }}<select
          id="file-select"
          [attr.aria-label]="'editor.chooseAProjectFile' | transloco"
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
        [attr.aria-label]="'common.fileContent' | transloco: { file: store.session().selectedFile }"
        [value]="store.editorContent()"
        (input)="edit($event)"
        (keydown)="shortcut($event)"
      ></textarea>
      <div class="editor-bottom">
        <span id="editor-status">{{
          store.editorDirty()
            ? ('editor.unsavedDraftPressSaveFile' | transloco)
            : ('editor.theEditorChangesOnlyWorkingFiles' | transloco)
        }}</span
        ><button
          class="button secondary small"
          data-action="save-file"
          (click)="store.dispatch({ type: 'editor/save' })"
        >
          {{ 'editor.saveFile' | transloco }}
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
