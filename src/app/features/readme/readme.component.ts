import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
  effect,
} from '@angular/core';
import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { badgeTopic, generatedBanner, profileThemes, themeFor } from './profile-presentation';
import { RouterLink } from '@angular/router';
import { profileReadme, safeProfileUrl, profileSections, sectionLabels } from './profile-readme';
import { draftKey, restoreDraft, workspaceSchema, readmeChecklist } from './readme-workspace';
import { ReadmeAssistantComponent, suggestionValue } from './readme-assistant.component';
import type { ReviewedSuggestion } from './readme-assistant.component';
import type { ProfileDraft, ProfileProject } from './profile-readme';
import {
  badgeMajors,
  badgeCatalog,
  profileBadgeUrl,
  selectedProfileBadges,
  frameworkLogoUrl,
  technologyImageUrl,
} from './profile-badges';
@Component({
  selector: 'app-profile-readme',
  imports: [RouterLink, ReadmeAssistantComponent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './readme.component.html',
  styleUrls: ['./readme.component.scss', './readme-studio.scss'],
})
export class ReadmeComponent {
  private readonly document = inject(DOCUMENT);
  protected readonly draft = signal<ProfileDraft>(this.loadDraft());
  protected readonly saved = signal('');
  protected readonly frameworkLogo = frameworkLogoUrl;
  protected technologyImage(name: string): string {
    return technologyImageUrl(
      name,
      this.draft().badgeFormat,
      this.theme().color,
      this.draft().badgeStyle,
    );
  }
  protected readonly themes = profileThemes;
  protected readonly theme = computed(() => themeFor(this.draft().theme));
  protected readonly badgeTopic = badgeTopic;
  protected readonly navigationSections = computed(() =>
    this.sections().filter((s) => !this.isCollapsed(s.id)),
  );
  protected isCollapsed(id: string): boolean {
    return this.draft().compact && ['skills', 'learning', 'highlights'].includes(id);
  }
  protected chooseTheme(id: string): void {
    this.draft.update((d) => ({ ...d, theme: id }));
  }
  protected toggleOption(key: 'compact' | 'autoBanner'): void {
    this.draft.update((d) => ({ ...d, [key]: !d[key] }));
  }
  protected addFocusBadges(): void {
    const tools = badgeMajors.find((item) => item.id === this.major())?.tools ?? [];
    this.draft.update((d) => ({ ...d, badges: [...new Set([...d.badges, ...tools])] }));
  }
  protected quickStart(): void {
    if (!this.draft().username.trim()) return;
    this.starter();
    this.draft.update((d) => ({
      ...d,
      name: d.name || d.username,
      layout: 'portfolio',
      autoBanner: true,
      compact: true,
    }));
    this.status.set(
      'Your profile is ready to personalize. Select only badges for tools you actually use.',
    );
  }
  protected readonly sections = computed(() => profileSections(this.draft()));
  protected readonly sectionOptions = Object.entries(sectionLabels).map(([id, title]) => ({
    id,
    title,
  }));
  protected readonly checklist = computed(() => readmeChecklist(this.draft()));
  protected readonly completedChecks = computed(
    () => this.checklist().filter((item) => item.done).length,
  );
  protected readonly lastAiChange = signal<ReviewedSuggestion | null>(null);
  protected readonly canUndo = computed(() => {
    const last = this.lastAiChange();
    return !!last && suggestionValue(this.draft(), last) === last.value;
  });
  protected readonly focusName = computed(
    () => badgeMajors.find((item) => item.id === this.major())?.name ?? 'Software engineering',
  );
  constructor() {
    effect(() => {
      const data = JSON.stringify({ version: 1, draft: this.draft() });
      try {
        this.document.defaultView?.localStorage.setItem(draftKey, data);
        this.saved.set('Draft saved on this device.');
      } catch {
        this.saved.set('Local saving is unavailable. Download a draft backup before leaving.');
      }
    });
  }
  private loadDraft(): ProfileDraft {
    try {
      return restoreDraft(this.document.defaultView?.localStorage.getItem(draftKey) ?? null);
    } catch {
      return restoreDraft(null);
    }
  }
  protected jump(id: string): void {
    const element = this.document.getElementById(id);
    const details = element?.closest('details');
    if (details) details.open = true;
    element?.scrollIntoView({
      block: 'center',
      behavior: this.document.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
    element?.focus({ preventScroll: true });
  }
  protected toggleSection(id: string): void {
    this.draft.update((d) => ({
      ...d,
      hidden: d.hidden.includes(id) ? d.hidden.filter((item) => item !== id) : [...d.hidden, id],
    }));
  }
  protected starter(): void {
    const focus = this.focusName().split(' / ')[0];
    this.draft.update((d) => ({
      ...d,
      headline: d.headline || `Exploring ${focus.toLowerCase()} through hands-on projects`,
      about:
        d.about ||
        `I'm interested in ${focus.toLowerCase()} and learning by building. This profile is a place to share my projects, document what I learn, and connect with other builders.`,
      learning:
        d.learning ||
        `Deepening my understanding of ${focus.toLowerCase()} through practice and project documentation.`,
    }));
    this.status.set('Starter text added to empty fields. Personalize it with your own facts.');
  }
  protected applyAi(suggestion: ReviewedSuggestion): void {
    if (suggestionValue(this.draft(), suggestion) !== suggestion.before) return;
    if (suggestion.field === 'headline' && suggestion.value.length > 180) return;
    this.draft.update((d) =>
      suggestion.field === 'project'
        ? {
            ...d,
            projects: d.projects.map((p) =>
              p.id === suggestion.projectId ? { ...p, description: suggestion.value } : p,
            ),
          }
        : { ...d, [suggestion.field]: suggestion.value },
    );
    this.lastAiChange.set(suggestion);
  }
  protected undoAi(): void {
    const last = this.lastAiChange();
    if (!last || !this.canUndo()) return;
    this.applyAi({ ...last, before: last.value, value: last.before });
    this.lastAiChange.set(null);
  }
  protected backup(): void {
    this.saveFile(
      'readme-draft.json',
      JSON.stringify({ version: 1, draft: this.draft() }, null, 2),
      'application/json',
    );
  }
  protected restore(event: Event): void {
    const input = event.target as HTMLInputElement,
      file = input.files?.[0];
    if (!file) return;
    if (file.size > 150000) {
      this.status.set('Choose a draft backup smaller than 150 KB.');
      input.value = '';
      return;
    }
    file
      .text()
      .then((text) => {
        const result = workspaceSchema.safeParse(JSON.parse(text));
        if (!result.success) throw new Error('This is not a valid README draft backup.');
        this.draft.set(restoreDraft(text));
        this.lastAiChange.set(null);
        this.status.set('Draft restored.');
      })
      .catch(() =>
        this.status.set('Could not restore this file. Your existing draft is unchanged.'),
      )
      .finally(() => (input.value = ''));
  }
  protected readonly markdown = computed(() => profileReadme(this.draft()));
  protected readonly majors = badgeMajors;
  protected readonly major = computed(() => this.draft().focus);
  protected readonly badgeSearch = signal('');
  protected badgeUrl(name: string): string {
    return profileBadgeUrl(name, this.theme().color, this.draft().badgeStyle);
  }
  protected readonly badges = computed(() => selectedProfileBadges(this.draft().badges));
  protected readonly suggestedBadges = computed(() => {
    const search = this.badgeSearch().trim().toLowerCase();
    const choices = search
      ? badgeCatalog
      : (badgeMajors.find((item) => item.id === this.major())?.tools ?? []);
    return choices.filter((name) => name.toLowerCase().includes(search));
  });
  protected changeMajor(event: Event): void {
    const focus = (event.target as HTMLSelectElement).value;
    if (badgeMajors.some((item) => item.id === focus))
      this.draft.update((draft) => ({ ...draft, focus }));
    this.badgeSearch.set('');
  }
  protected searchBadges(event: Event): void {
    this.badgeSearch.set((event.target as HTMLInputElement).value);
  }
  protected toggleBadge(name: string): void {
    this.draft.update((draft) => ({
      ...draft,
      badges: draft.badges.includes(name)
        ? draft.badges.filter((badge) => badge !== name)
        : [...draft.badges, name],
    }));
  }
  protected clearBadges(): void {
    this.draft.update((draft) => ({ ...draft, badges: [] }));
  }
  protected readonly banner = computed(
    () => safeProfileUrl(this.draft().banner) ?? generatedBanner(this.draft()),
  );
  protected readonly bannerFailed = linkedSignal(() => {
    this.banner();
    return false;
  });
  protected removeBanner(): void {
    this.draft.update((draft) => ({ ...draft, banner: '', bannerAlt: '', autoBanner: false }));
  }
  protected readonly view = signal<'preview' | 'markdown'>('preview');
  protected readonly status = linkedSignal(() => {
    this.markdown();
    return '';
  });
  protected readonly errors = computed(() => {
    const draft = this.draft();
    const errors: string[] = [];
    if (draft.banner.trim() && !safeProfileUrl(draft.banner))
      errors.push(
        'Banner must be a public http:// or https:// image URL without embedded credentials.',
      );
    if (
      draft.username &&
      (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(draft.username) ||
        draft.username.includes('--'))
    )
      errors.push('Use a GitHub username, not a profile URL.');
    if (draft.website.trim() && !safeProfileUrl(draft.website))
      errors.push('Website must be a valid http:// or https:// URL without embedded credentials.');
    if (draft.linkedin.trim() && !safeProfileUrl(draft.linkedin))
      errors.push('LinkedIn must be a valid http:// or https:// URL without embedded credentials.');
    for (const project of draft.projects) {
      if (project.url.trim() && !safeProfileUrl(project.url))
        errors.push(
          `Check the URL for ${project.name || 'your untitled project'}. Use http:// or https://.`,
        );
      if ((project.url.trim() || project.description.trim()) && !project.name.trim())
        errors.push('Add a name to each project you want to include.');
    }
    return errors;
  });
  protected readonly ready = computed(
    () => !!this.draft().name.trim() && !!this.draft().username.trim() && !this.errors().length,
  );
  protected update(
    field: Exclude<keyof ProfileDraft, 'projects' | 'badges' | 'hidden' | 'autoBanner' | 'compact'>,
    event: Event,
  ): void {
    const value = (event.target as HTMLInputElement).value;
    this.draft.update((draft) => ({
      ...draft,
      [field]: field === 'username' ? value.trim() : value,
    }));
  }
  protected addProject(): void {
    if (this.draft().projects.length >= 6) return;
    this.draft.update((draft) => ({
      ...draft,
      projects: [
        ...draft.projects,
        {
          id: Math.max(0, ...draft.projects.map((p) => p.id)) + 1,
          name: '',
          description: '',
          url: '',
          outcome: '',
        },
      ],
    }));
  }
  protected updateProject(
    id: number,
    field: Exclude<keyof ProfileProject, 'id'>,
    event: Event,
  ): void {
    const value = (event.target as HTMLInputElement).value;
    this.draft.update((draft) => ({
      ...draft,
      projects: draft.projects.map((project) =>
        project.id === id ? { ...project, [field]: value } : project,
      ),
    }));
  }
  protected removeProject(id: number): void {
    this.draft.update((draft) => ({
      ...draft,
      projects: draft.projects.filter((project) => project.id !== id),
    }));
  }
  protected copy(): void {
    if (!this.ready()) return;
    const clipboard = this.document.defaultView?.navigator.clipboard;
    if (!clipboard) {
      this.view.set('markdown');
      this.status.set('Clipboard unavailable. Select and copy the Markdown below.');
      return;
    }
    clipboard.writeText(this.markdown()).then(
      () => this.status.set('README copied.'),
      () => {
        this.view.set('markdown');
        this.status.set('Clipboard access denied. Select and copy the Markdown below.');
      },
    );
  }
  protected download(): void {
    if (!this.ready()) return;
    this.saveFile('README.md', this.markdown(), 'text/markdown;charset=utf-8');
    this.status.set('README.md downloaded.');
  }
  private saveFile(name: string, content: string, type: string): void {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = this.document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
