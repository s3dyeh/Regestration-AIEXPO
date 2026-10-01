import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  input,
  linkedSignal,
  output,
  viewChild,
} from '@angular/core';
import type { ElementRef } from '@angular/core';
import { commands } from '../domain/parser';
import type { TerminalEntry } from '../state/session';

@Component({
  selector: 'app-learning-terminal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div id="terminal" dir="ltr" [class.expanded]="expanded()">
      <div class="terminal-bar">
        <span class="terminal-lights"><i></i><i></i><i></i></span
        ><span>student&#64;booth · {{ branch() }}</span
        ><button
          type="button"
          class="terminal-zoom"
          [attr.aria-label]="expanded() ? 'تصغير الطرفية' : 'تكبير الطرفية'"
          [attr.aria-pressed]="expanded()"
          (click)="toggleExpanded()"
        >
          ↗
        </button>
      </div>
      <div
        #log
        class="terminal-output"
        role="log"
        aria-label="مخرجات الطرفية"
        aria-live="polite"
        tabindex="0"
      >
        @if (!entries().length) {
          <pre
            class="welcome-line"
          >Git Booth / interactive laboratory<br>Educational IDs: c001… · type help to explore</pre>
        }
        @for (entry of entries(); track $index) {
          <div>
            <pre class="command-line">❯ {{ entry.command }}</pre>
            <pre [class]="entry.error ? 'output-error' : 'output-line'">{{ entry.output }}</pre>
          </div>
        }
      </div>
      <form class="command-form" (submit)="submit($event)">
        <label for="command-input" class="prompt">❯</label
        ><input
          #commandInput
          id="command-input"
          aria-label="اكتب أمر Git"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          placeholder="git status"
          [value]="command()"
          (input)="editCommand($event)"
          (keydown)="handleKey($event)"
        /><button type="submit" aria-label="تنفيذ الأمر">Enter ↵</button>
      </form>
      <div class="terminal-foot">
        SIMULATION · NO SYSTEM COMMANDS <span>↑ ↓ history &nbsp; ⇥ complete</span>
      </div>
    </div>
    <div class="command-palette" aria-label="أوامر مقترحة">
      <small>اضغط لتعبئة الأمر، ثم نفّذه بنفسك</small>
      <div>
        @for (suggestion of suggestions(); track suggestion) {
          <button type="button" dir="ltr" (click)="fill(suggestion)">{{ suggestion }}</button>
        }
      </div>
    </div>
  `,
})
export class LearningTerminalComponent {
  readonly branch = input.required<string>();
  readonly entries = input.required<TerminalEntry[]>();
  readonly history = input.required<string[]>();
  readonly suggestions = input.required<string[]>();
  readonly checkpoint = input.required<number>();
  readonly execute = output<string>();
  protected readonly command = linkedSignal(() => {
    this.checkpoint();
    return '';
  });
  protected readonly expanded = linkedSignal(() => {
    this.checkpoint();
    return false;
  });
  private readonly cursor = linkedSignal<number | null>(() => {
    this.checkpoint();
    return null;
  });
  private readonly draft = linkedSignal(() => {
    this.checkpoint();
    return '';
  });
  private readonly commandInput = viewChild<ElementRef<HTMLInputElement>>('commandInput');
  private readonly log = viewChild<ElementRef<HTMLDivElement>>('log');
  constructor() {
    afterRenderEffect({
      earlyRead: () => {
        this.entries();
        const log = this.log()?.nativeElement;
        return { log, height: log?.scrollHeight ?? 0 };
      },
      write: (data) => {
        const { log, height } = data();
        if (log) log.scrollTop = height;
      },
    });
  }
  protected editCommand(event: Event): void {
    this.command.set((event.target as HTMLInputElement).value);
  }
  protected fill(command: string): void {
    this.command.set(command);
    this.commandInput()?.nativeElement.focus();
  }
  protected toggleExpanded(): void {
    this.expanded.update((value) => !value);
    this.commandInput()?.nativeElement.focus();
  }
  protected submit(event: Event): void {
    event.preventDefault();
    if (!this.command().trim()) return;
    this.execute.emit(this.command());
    this.command.set('');
    this.cursor.set(null);
    this.draft.set('');
  }
  protected handleKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.cursor() === null) {
        this.draft.set(this.command());
        this.cursor.set(this.history().length);
      }
      const cursor = Math.max(0, (this.cursor() ?? 0) - 1);
      this.cursor.set(cursor);
      this.command.set(this.history()[cursor] ?? '');
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const cursor = Math.min(this.history().length, (this.cursor() ?? this.history().length) + 1);
      this.cursor.set(cursor);
      this.command.set(this.history()[cursor] ?? this.draft());
    }
    if (event.key === 'Tab') {
      const match = commands.find(
        (candidate) => candidate.startsWith(this.command()) && candidate !== this.command(),
      );
      if (match) {
        event.preventDefault();
        this.command.set(match);
      }
    }
    if (event.key === 'Escape') this.expanded.set(false);
  }
}
