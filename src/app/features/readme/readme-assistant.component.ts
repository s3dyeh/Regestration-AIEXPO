import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromFetch } from 'rxjs/fetch';
import { catchError, finalize, of, switchMap, timeout } from 'rxjs';
import { aiResultSchema } from './readme-ai-contract';
import type { ReadmeSuggestion } from './readme-ai-contract';
import type { ProfileDraft } from './profile-readme';

export interface ReviewedSuggestion extends ReadmeSuggestion {
  before: string;
}
export function suggestionValue(draft: ProfileDraft, suggestion: ReadmeSuggestion): string {
  return suggestion.field === 'project'
    ? (draft.projects.find((p) => p.id === suggestion.projectId)?.description ?? '')
    : draft[suggestion.field];
}
@Component({
  selector: 'app-readme-assistant',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="assistant" aria-label="AI writing assistant" [attr.aria-busy]="busy()">
      <p class="eyebrow">OPTIONAL WRITING PARTNER</p>
      <h2>Make your story clearer</h2>
      <p>
        Write a few facts first. AI can polish your introduction and project descriptions without
        replacing the whole README.
      </p>
      <label for="ai-tone">Writing tone</label>
      <select id="ai-tone" [value]="tone()" (change)="setTone($event)">
        <option value="clear">Clear and professional</option>
        <option value="friendly">Friendly and personal</option>
        <option value="concise">Short and direct</option>
      </select>
      <p class="note">
        Clicking below sends your profile prose, technologies and project descriptions to OpenAI
        through this site's server. Links, banner images and GitHub tokens are not sent. Review
        every claim before using it.
      </p>
      <button type="button" (click)="suggest()" [disabled]="busy() || !hasFacts()">
        {{ busy() ? 'Writing suggestions…' : 'Suggest improvements with AI' }}
      </button>
      @if (!hasFacts()) {
        <p class="note">
          Add at least 30 characters to About you, Currently building, or a project description.
        </p>
      }
      <p role="status">{{ message() }}</p>
      @for (suggestion of suggestions(); track $index; let i = $index) {
        <article class="suggestion">
          <h3>{{ fieldLabel(suggestion) }}</h3>
          <p class="note">{{ suggestion.reason }}</p>
          <div class="before">
            <strong>Current</strong>
            <p>{{ suggestion.before || 'Empty' }}</p>
          </div>
          <div class="after">
            <strong>Suggested</strong>
            <p>{{ suggestion.value }}</p>
          </div>
          @if (stale(suggestion)) {
            <p class="note">
              You changed this field. Generate fresh suggestions to avoid overwriting your edit.
            </p>
          }
          <div class="actions">
            <button type="button" [disabled]="stale(suggestion)" (click)="accept(i)">
              Apply suggestion</button
            ><button type="button" class="secondary" (click)="dismiss(i)">Dismiss</button>
          </div>
        </article>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
    .assistant {
      padding: 24px;
      background: #edf2e8;
      border: 1px solid #c7d5c3;
      border-radius: 12px;
      margin-block: 24px;
      color: #203b32;
    }
    h2 {
      margin: 8px 0;
      font-size: 24px;
    }
    h3 {
      font-size: 16px;
    }
    p {
      font-size: 14px;
      line-height: 1.7;
      white-space: pre-line;
      overflow-wrap: anywhere;
    }
    .eyebrow {
      font-size: 11px;
      letter-spacing: 0.12em;
    }
    .note {
      font-size: 12px;
      color: #52665b;
    }
    label {
      display: block;
      font-weight: 600;
      font-size: 13px;
      margin: 16px 0 8px;
    }
    select,
    button {
      font: inherit;
      font-size: 13px;
      min-height: 44px;
      border: 1px solid #25654e;
      border-radius: 6px;
      padding: 10px 14px;
    }
    select {
      max-width: 100%;
      background: white;
    }
    button {
      background: #25654e;
      color: white;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .secondary {
      background: white;
      color: #25654e;
    }
    .suggestion {
      background: white;
      padding: 18px;
      margin-top: 16px;
      border-radius: 8px;
    }
    .before,
    .after {
      padding: 12px;
      border-inline-start: 3px solid #c7d5c3;
    }
    .after {
      border-color: #25654e;
      background: #f5f7f1;
    }
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 12px;
    }
    :where(button, select):focus-visible {
      outline: 3px solid #33865e;
      outline-offset: 3px;
    }
  `,
})
export class ReadmeAssistantComponent {
  readonly draft = input.required<ProfileDraft>();
  readonly focus = input('Software engineering');
  readonly applySuggestion = output<ReviewedSuggestion>();
  protected readonly busy = signal(false);
  protected readonly message = signal('');
  protected readonly tone = signal<'clear' | 'friendly' | 'concise'>('clear');
  protected readonly suggestions = signal<ReviewedSuggestion[]>([]);
  protected readonly hasFacts = computed(
    () =>
      [
        this.draft().about,
        this.draft().currentWork,
        ...this.draft().projects.map((p) => p.description),
      ]
        .join('')
        .trim().length >= 30,
  );
  private readonly destroyRef = inject(DestroyRef);
  protected setTone(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value === 'clear' || value === 'friendly' || value === 'concise') this.tone.set(value);
  }
  protected stale(s: ReviewedSuggestion): boolean {
    return (
      suggestionValue(this.draft(), s) !== s.before ||
      (s.field === 'project' && !this.draft().projects.some((p) => p.id === s.projectId))
    );
  }
  protected fieldLabel(s: ReadmeSuggestion): string {
    return s.field === 'project'
      ? this.draft().projects.find((p) => p.id === s.projectId)?.name || 'Project description'
      : {
          headline: 'Headline',
          about: 'About me',
          learning: 'Currently learning',
          collaboration: 'Collaboration',
          currentWork: 'Currently building',
          highlights: 'Highlights',
        }[s.field];
  }
  protected dismiss(index: number): void {
    this.suggestions.update((items) => items.filter((_, i) => i !== index));
  }
  protected accept(index: number): void {
    const s = this.suggestions()[index];
    if (!s || this.stale(s)) return;
    this.applySuggestion.emit(s);
    this.dismiss(index);
  }
  protected suggest(): void {
    if (this.busy() || !this.hasFacts()) return;
    const draft = structuredClone(this.draft());
    const { headline, about, skills, learning, collaboration, currentWork, highlights } = draft;
    this.busy.set(true);
    this.message.set('');
    this.suggestions.set([]);
    fromFetch('/api/readme-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        focus: this.focus(),
        tone: this.tone(),
        facts: {
          headline,
          about,
          skills,
          learning,
          collaboration,
          currentWork,
          highlights,
          projects: draft.projects.map(({ id, name, description, outcome }) => ({
            id,
            name,
            description,
            outcome: outcome ?? '',
          })),
        },
      }),
      selector: (response) =>
        response
          .json()
          .then((data) => {
            if (!response.ok)
              throw new Error(
                typeof data.message === 'string'
                  ? data.message
                  : 'AI is unavailable. Your draft is safe.',
              );
            return data;
          })
          .catch((error) => {
            if (response.headers.get('content-type')?.includes('text/html'))
              throw new Error(
                'The AI endpoint is available through Vercel. Run vercel dev locally or deploy with OPENAI_API_KEY.',
              );
            throw error;
          }),
    })
      .pipe(
        timeout(30000),
        switchMap((value) => {
          const result = aiResultSchema.safeParse(value);
          if (!result.success)
            throw new Error('AI returned an invalid response. Your draft is unchanged.');
          return of(result.data);
        }),
        catchError((error: unknown) => {
          this.message.set(
            error instanceof Error ? error.message : 'AI writing is unavailable. Please try later.',
          );
          return of(null);
        }),
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (!result) return;
        this.suggestions.set(
          result.suggestions.map((s) => ({ ...s, before: suggestionValue(draft, s) })),
        );
        this.message.set(
          result.note ||
            (result.suggestions.length
              ? 'Review each suggestion before applying.'
              : 'No changes suggested. Add more concrete facts for useful feedback.'),
        );
      });
  }
}
