import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterLink } from '@angular/router';
import { emptyProfile, profileReadme, profileSkills, safeProfileUrl } from './profile-readme';
import type { ProfileDraft, ProfileProject } from './profile-readme';
import {
  badgeMajors,
  badgeCatalog,
  profileBadgeUrl,
  selectedProfileBadges,
} from './profile-badges';
@Component({
  selector: 'app-profile-readme',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './readme.component.html',
  styleUrl: './readme.component.scss',
})
export class ReadmeComponent {
  protected readonly draft = signal<ProfileDraft>({ ...emptyProfile, projects: [] });
  protected readonly markdown = computed(() => profileReadme(this.draft()));
  protected readonly skills = computed(() => profileSkills(this.draft().skills));
  protected readonly majors = badgeMajors;
  protected readonly major = signal('software');
  protected readonly badgeSearch = signal('');
  protected readonly badgeUrl = profileBadgeUrl;
  protected readonly badges = computed(() => selectedProfileBadges(this.draft().badges));
  protected readonly suggestedBadges = computed(() => {
    const search = this.badgeSearch().trim().toLowerCase();
    const choices = search
      ? badgeCatalog
      : (badgeMajors.find((item) => item.id === this.major())?.tools ?? []);
    return choices.filter((name) => name.toLowerCase().includes(search));
  });
  protected changeMajor(event: Event): void {
    this.major.set((event.target as HTMLSelectElement).value);
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
  protected readonly projects = computed(() =>
    this.draft()
      .projects.filter((item) => item.name.trim())
      .map((item) => ({ ...item, link: safeProfileUrl(item.url) })),
  );
  protected readonly website = computed(() => safeProfileUrl(this.draft().website));
  protected readonly banner = computed(() => safeProfileUrl(this.draft().banner));
  protected readonly bannerFailed = linkedSignal(() => {
    this.banner();
    return false;
  });
  protected removeBanner(): void {
    this.draft.update((draft) => ({ ...draft, banner: '', bannerAlt: '' }));
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
  private readonly document = inject(DOCUMENT);
  private nextId = 1;
  protected update(field: Exclude<keyof ProfileDraft, 'projects' | 'badges'>, event: Event): void {
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
      projects: [...draft.projects, { id: this.nextId++, name: '', description: '', url: '' }],
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
    const url = URL.createObjectURL(
      new Blob([this.markdown()], { type: 'text/markdown;charset=utf-8' }),
    );
    const link = this.document.createElement('a');
    link.href = url;
    link.download = 'README.md';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.status.set('README.md downloaded.');
  }
}
