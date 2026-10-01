import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromFetch } from 'rxjs/fetch';
import { catchError, finalize, of, timeout } from 'rxjs';
import { generationRequestSchema, generationResponseSchema } from './readme-generation-contract';
import type { z } from 'zod';
export type GeneratedProfile = z.infer<typeof generationResponseSchema>;
@Component({
  selector: 'app-readme-generator', changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" (click)="generate()" [disabled]="busy() || !valid()">{{ busy() ? 'Reading GitHub and writing your README…' : 'Build my README with AI' }}</button>
    <p>Your name, major and public GitHub profile, repository languages and README excerpts are sent to OpenAI. AI fills the editor; you can change everything afterward.</p>
    <p>Building again replaces the written draft. You can undo generation before making further edits.</p>
    <p role="status" aria-live="polite">{{ message() }}</p>
  `,
  styles: `:host{display:block;margin-top:24px}button{width:100%;min-height:54px;padding:14px;border:0;border-radius:6px;background:#25654e;color:white;font:600 16px Manrope,system-ui;cursor:pointer}button:disabled{opacity:.55;cursor:not-allowed}button:focus-visible{outline:3px solid #33865e;outline-offset:3px}p{font-size:12px;line-height:1.7;color:#52665b}`,
})
export class ReadmeGeneratorComponent {
  readonly name = input.required<string>(); readonly username = input.required<string>(); readonly focus = input.required<string>();
  readonly started = output<void>(); readonly generated = output<GeneratedProfile>();
  protected readonly busy = signal(false); protected readonly message = signal('');
  private readonly destroyRef = inject(DestroyRef);
  protected readonly valid = computed(() => generationRequestSchema.safeParse({ mode: 'generate', name: this.name(), username: this.username(), focus: this.focus() }).success);
  protected generate(): void {
    if (this.busy() || !this.valid()) return;
    this.busy.set(true); this.message.set('This can take up to a minute. Your draft stays safe if the request fails.'); this.started.emit();
    fromFetch('/api/readme-ai', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'generate', name: this.name().trim(), username: this.username().trim(), focus: this.focus() }),
      selector: response => response.text().then(body => {
        let data: unknown;
        try { data = JSON.parse(body); } catch { throw new Error(response.status >= 500 ? 'AI server failed. Check Vercel Runtime Logs and redeploy the latest code. Your draft is safe.' : 'The AI endpoint is unavailable. Your draft is safe.'); }
        if (!response.ok) throw new Error(data && typeof data === 'object' && 'message' in data && typeof data.message === 'string' ? data.message : 'AI generation failed. Your draft is safe.');
        const parsed = generationResponseSchema.safeParse(data);
        if (!parsed.success) throw new Error('AI returned an invalid draft. Your current draft is unchanged.');
        return parsed.data;
      }),
    }).pipe(timeout(55000), catchError((error: unknown) => { this.message.set(error instanceof Error ? error.message : 'Generation failed. Please try later.'); return of(null); }), finalize(() => this.busy.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe(result => {
      if (!result) return;
      this.generated.emit(result); this.message.set('');
    });
  }
}
