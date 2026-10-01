import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  viewChild,
} from '@angular/core';
import type { ElementRef } from '@angular/core';
import { GitLearningStore } from '../state/git-learning.store';
import { WorkshopDialogService } from '../state/workshop-dialog.service';
import { commandReference } from '../curriculum/reference';
@Component({
  selector: 'app-workshop-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dialog.component.html',
})
export class LearningDialogComponent {
  protected readonly store = inject(GitLearningStore);
  protected readonly dialog = inject(WorkshopDialogService);
  protected readonly query = linkedSignal(() => {
    this.dialog.selection();
    return '';
  });
  protected readonly reference = computed(() => {
    const normalize = (value: string) =>
      value.toLocaleLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim();
    const terms = normalize(this.query()).split(/\s+/).filter(Boolean);
    return commandReference.filter((group) =>
      terms.every((term) => normalize(group.join(' ')).includes(term)),
    );
  });
  protected search(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }
  private readonly element = viewChild<ElementRef<HTMLDialogElement>>('dialogElement');
  private previousFocus: HTMLElement | null = null;
  protected readonly title = computed(() => {
    const selection = this.dialog.selection();
    if (!selection) return '';
    if (selection.kind === 'commit') return selection.id + ' · داخل الـcommit';
    return {
      course: 'مسار تعلّم Git',
      reference: 'دليل الأوامر والمفاهيم',
      settings: 'إعدادات العرض',
      reset: 'إعادة الجولة من البداية؟',
      fullscreen: 'ملء الشاشة',
    }[selection.kind];
  });
  protected readonly inspector = computed(() => {
    const selection = this.dialog.selection();
    if (selection?.kind !== 'commit') return null;
    const repository = this.store.git(),
      commit = repository.commits[selection.id];
    if (!commit) return null;
    return {
      commit,
      files: Object.entries(commit.tree).map(([file, content], index) => ({
        file,
        content,
        index,
        shared: Object.values(repository.commits).filter(
          (other) => other.id !== commit.id && Object.values(other.tree).includes(content),
        ).length,
      })),
    };
  });
  constructor() {
    afterRenderEffect({
      write: () => {
        const selection = this.dialog.selection(),
          element = this.element()?.nativeElement;
        if (!element) return;
        if (selection && !element.open) {
          this.previousFocus = element.ownerDocument.activeElement as HTMLElement;
          element.showModal();
        } else if (!selection && element.open) {
          element.close();
          this.previousFocus?.focus();
        }
      },
    });
  }
  protected cancel(event: Event): void {
    event.preventDefault();
    this.dialog.close();
  }
  protected backdrop(event: MouseEvent): void {
    const element = this.element()?.nativeElement;
    if (event.target !== element || !element) return;
    const rect = element.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      this.dialog.close();
  }
  protected reset(): void {
    this.store.dispatch({ type: 'session/reset' });
    this.dialog.close();
    window.scrollTo({ top: 0 });
  }
}
