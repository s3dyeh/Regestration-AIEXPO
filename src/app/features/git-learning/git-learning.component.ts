import { TranslocoPipe } from '@jsverse/transloco';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  inject,
  viewChild,
} from '@angular/core';
import type { ElementRef } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterLink } from '@angular/router';
import { GitLearningStore } from './state/git-learning.store';
import { WorkshopDialogService } from './state/workshop-dialog.service';
import { LearningSceneComponent } from './ui/scene.component';
import { LearningTerminalComponent } from './ui/terminal.component';
import { LearningEditorComponent } from './ui/editor.component';
import { LearningDialogComponent } from './ui/dialog.component';
import { LearningCoachComponent } from './ui/learning-coach.component';
import { WorkshopLocale } from './i18n/workshop-i18n';
@Component({
  selector: 'app-git-learning',
  imports: [
    TranslocoPipe,
    RouterLink,
    LearningSceneComponent,
    LearningTerminalComponent,
    LearningEditorComponent,
    LearningDialogComponent,
    LearningCoachComponent,
  ],
  providers: [GitLearningStore, WorkshopDialogService, WorkshopLocale],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './git-learning.component.html',
})
export class GitLearningComponent {
  protected readonly locale = inject(WorkshopLocale);
  protected readonly store = inject(GitLearningStore);
  protected readonly dialog = inject(WorkshopDialogService);
  private readonly document = inject(DOCUMENT);
  private readonly heading = viewChild<ElementRef<HTMLHeadingElement>>('heading');
  constructor() {
    afterRenderEffect({
      write: () => {
        this.store.checkpoint();
        this.heading()?.nativeElement.focus({ preventScroll: true });
      },
    });
  }
  protected next(): void {
    this.store.dispatch({ type: this.store.final() ? 'session/reset' : 'wizard/next' });
    this.document.defaultView?.scrollTo({ top: 0, behavior: 'instant' });
  }
  protected fullscreen(): void {
    if (!this.document.fullscreenEnabled) {
      this.dialog.open({ kind: 'fullscreen' });
      return;
    }
    const request = this.document.fullscreenElement
      ? this.document.exitFullscreen()
      : this.document.documentElement.requestFullscreen();
    request.catch(() => this.dialog.open({ kind: 'fullscreen' }));
  }
  protected navigate(id: 'command-input' | 'file-content'): void {
    const element = this.document.getElementById(id);
    element?.scrollIntoView({ block: 'center', behavior: 'instant' });
    element?.focus({ preventScroll: true });
  }
}
