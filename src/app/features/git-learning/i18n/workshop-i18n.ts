import { DOCUMENT } from '@angular/common';
import { computed, DestroyRef, effect, inject, Injectable, isDevMode } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import type { TranslocoLoader } from '@jsverse/transloco';
import { of } from 'rxjs';
import ar from './ar.json';
import en from './en.json';

export type WorkshopLanguage = 'ar' | 'en';
const catalogs: Record<WorkshopLanguage, Record<keyof typeof ar, string>> = { ar, en };
const languageKey = 'careerlens.git-learning.language';

/** Bundled with the lazy workshop route: switching languages also works offline. */
@Injectable()
export class WorkshopTranslationLoader implements TranslocoLoader {
  getTranslation(lang: string) {
    return of(catalogs[lang === 'en' ? 'en' : 'ar']);
  }
}

export const workshopTranslationProviders = [
  TranslocoService,
  provideTransloco({
    config: {
      availableLangs: ['ar', 'en'],
      defaultLang: 'ar',
      fallbackLang: 'ar',
      reRenderOnLangChange: true,
      prodMode: !isDevMode(),
    },
    loader: WorkshopTranslationLoader,
  }),
];

/** Locale is presentation state, separate from the replayable learning journal. */
@Injectable()
export class WorkshopLocale {
  private readonly document = inject(DOCUMENT);
  private readonly transloco = inject(TranslocoService);
  readonly language = toSignal(this.transloco.langChanges$, { requireSync: true });
  readonly direction = computed(() => (this.language() === 'ar' ? 'rtl' : 'ltr'));

  constructor() {
    for (const language of ['ar', 'en'] as const) {
      this.transloco.setTranslation(catalogs[language], language, { emitChange: false });
    }
    let language: WorkshopLanguage = 'ar';
    try {
      if (this.document.defaultView?.localStorage.getItem(languageKey) === 'en') language = 'en';
    } catch {
      /* Language switching remains available when storage is blocked. */
    }
    this.transloco.setActiveLang(language);

    const root = this.document.documentElement;
    const previous = { lang: root.getAttribute('lang'), dir: root.getAttribute('dir') };
    effect(() => {
      root.setAttribute('lang', this.language());
      root.setAttribute('dir', this.direction());
    });
    inject(DestroyRef).onDestroy(() => {
      for (const attribute of ['lang', 'dir'] as const) {
        const value = previous[attribute];
        if (value === null) root.removeAttribute(attribute);
        else root.setAttribute(attribute, value);
      }
    });
  }

  select(event: Event): void {
    const language = (event.target as HTMLSelectElement).value;
    if (language !== 'en' && language !== 'ar') return;
    this.transloco.setActiveLang(language);
    try {
      this.document.defaultView?.localStorage.setItem(languageKey, language);
    } catch {
      /* Persistence is optional; the active language still changes. */
    }
  }
}
