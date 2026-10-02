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
import { badgeTopic, generatedBannerPreview, themeFor } from './profile-presentation';
import { RouterLink } from '@angular/router';
import { ReadmeGeneratorComponent } from './readme-generator.component';
import type { GeneratedProfile } from './readme-generator.component';
import { profileReadme, safeProfileUrl, profileSections } from './profile-readme';
import { draftKey, restoreDraft } from './readme-workspace';
import type { ProfileDraft, ProfileProject } from './profile-readme';
import {
  badgeMajors,
  badgeCatalog,
  profileBadgeUrl,
  technologyImageUrl,
  linkedInLogoUrl,
} from './profile-badges';
@Component({
  selector: 'app-profile-readme',
  imports: [RouterLink, ReadmeGeneratorComponent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './readme.component.html',
  styleUrls: ['./readme.component.scss', './readme-studio.scss'],
})
export class ReadmeComponent {
  private readonly document = inject(DOCUMENT);
  protected readonly draft = signal<ProfileDraft>(this.loadDraft());
  protected readonly saved = signal('');
  protected readonly step = signal(this.draft().about || this.draft().headline ? 2 : 0);
  protected readonly includeProjects = signal(true);
  protected readonly editing = signal(false);
  protected readonly identityReady = computed(
    () =>
      !!this.draft().name.trim() &&
      /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(this.draft().username) &&
      !this.draft().username.includes('--'),
  );
  protected readonly editFields = [
    { key: 'headline', label: 'Headline', max: 180 },
    { key: 'about', label: 'About you', max: 3000 },
    { key: 'currentWork', label: 'Currently building', max: 1500 },
    { key: 'highlights', label: 'Highlights', max: 2000 },
    { key: 'skills', label: 'Tools and technologies', max: 1000 },
    { key: 'learning', label: 'Currently learning', max: 1500 },
    { key: 'collaboration', label: 'Open to collaborating on', max: 1500 },
  ] as const;
  protected nextStep(): void {
    if (this.identityReady()) this.step.set(1);
  }
  protected readonly linkedInLogo = linkedInLogoUrl;
  protected readonly generationNote = signal('');
  private generationBaseline: ProfileDraft | null = null;
  private previousDraft: ProfileDraft | null = null;
  protected readonly generatedSnapshot = signal('');
  protected readonly canUndoGeneration = computed(
    () => !!this.generatedSnapshot() && JSON.stringify(this.draft()) === this.generatedSnapshot(),
  );
  protected generationStarted(): void {
    this.generationBaseline = structuredClone(this.draft());
    this.generationNote.set('');
  }
  protected applyGeneration(result: GeneratedProfile): void {
    const baseline = this.generationBaseline,
      current = this.draft();
    if (
      !baseline ||
      (['username', 'name', 'focus'] as const).some((key) => baseline[key] !== current[key])
    ) {
      this.generationNote.set(
        'Your name, username or major changed during generation. Build again to use the new information.',
      );
      return;
    }
    const { skills, projects, ...prose } = result.content;
    const proposal: ProfileDraft = {
      ...current,
      ...prose,
      skills: skills.join(', '),
      badges: result.badges.filter((name) => badgeCatalog.some((tool) => tool === name)),
      location: result.location,
      website: safeProfileUrl(result.website) ?? '',
      projects: projects.flatMap((project) => {
        const repo = result.repositories.find((repo) => repo.id === project.id);
        return repo
          ? [
              {
                id: project.id,
                name: repo.name,
                url: safeProfileUrl(repo.url) ?? '',
                description: project.description,
                outcome: project.outcome,
              },
            ]
          : [];
      }),
      layout: 'portfolio',
      autoBanner: true,
      compact: true,
      badgeFormat: 'logos',
    };
    // Preserve edits made while the network request was in flight, including project removals.
    for (const key of Object.keys(current) as (keyof ProfileDraft)[]) {
      if (JSON.stringify(current[key]) !== JSON.stringify(baseline[key]))
        Object.assign(proposal, { [key]: current[key] });
    }
    this.previousDraft = structuredClone(current);
    this.draft.set(proposal);
    this.generatedSnapshot.set(JSON.stringify(proposal));
    this.step.set(2);
    this.generationNote.set(result.note);
  }
  protected undoGeneration(): void {
    if (!this.canUndoGeneration() || !this.previousDraft) return;
    this.draft.set(this.previousDraft);
    this.previousDraft = null;
    this.generatedSnapshot.set('');
    this.step.set(this.draft().about || this.draft().headline ? 2 : 1);
    this.generationNote.set('Previous draft restored.');
  }
  protected technologyImage(name: string): string {
    return technologyImageUrl(
      name,
      this.draft().badgeFormat,
      this.theme().color,
      this.draft().badgeStyle,
    );
  }
  protected readonly theme = computed(() => themeFor(this.draft().theme));
  protected readonly badgeTopic = badgeTopic;
  protected readonly navigationSections = computed(() =>
    this.sections().filter((s) => !this.isCollapsed(s.id)),
  );
  protected isCollapsed(id: string): boolean {
    return this.draft().compact && ['skills', 'learning', 'highlights'].includes(id);
  }
  protected readonly sections = computed(() => profileSections(this.draft()));
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
        this.saved.set('Local saving is unavailable. Download your README before leaving.');
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
  protected readonly markdown = computed(() => profileReadme(this.draft()));
  protected readonly majors = badgeMajors;
  protected readonly major = computed(() => this.draft().focus);
  protected badgeUrl(name: string): string {
    return profileBadgeUrl(name, this.theme().color, this.draft().badgeStyle);
  }
  protected changeMajor(event: Event): void {
    const focus = (event.target as HTMLSelectElement).value;
    if (badgeMajors.some((item) => item.id === focus))
      this.draft.update((draft) => ({ ...draft, focus }));
  }
  protected clearBadges(): void {
    this.draft.update((draft) => ({ ...draft, badges: [] }));
  }
  protected readonly banner = computed(
    () => safeProfileUrl(this.draft().banner) ?? generatedBannerPreview(this.draft()),
  );
  protected readonly bannerFailed = linkedSignal(() => {
    this.banner();
    return false;
  });
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
