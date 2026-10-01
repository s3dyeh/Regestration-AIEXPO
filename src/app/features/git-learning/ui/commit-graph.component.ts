import { TranslocoPipe } from '@jsverse/transloco';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';
import type { ElementRef } from '@angular/core';
import { isAncestor, tip } from '../domain/engine';
import type { GitState } from '../domain/engine';

@Component({
  selector: 'app-learning-graph',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!graph().nodes.length) {
      <div class="empty-history">{{ 'commit_graph.noCommitsYetItStartsWithYou' | transloco }}</div>
    } @else {
      <div
        #canvas
        class="commit-graph"
        dir="ltr"
        tabindex="0"
        [attr.aria-label]="'commit_graph.historyScrollsHorizontally' | transloco"
      >
        <svg
          [attr.viewBox]="'0 0 ' + graph().width + ' 205'"
          [style.min-width.px]="graph().minWidth"
          role="group"
          [attr.aria-label]="'commit_graph.repositoryHistoryGraphArrowsPointFromA' | transloco"
        >
          <defs>
            <marker
              id="git-parent-arrow"
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3"
              orient="auto"
            >
              <path d="M0 0L6 3L0 6" fill="none" stroke="#77908c" />
            </marker>
          </defs>
          @for (edge of graph().edges; track edge.id) {
            <path class="commit-edge" [attr.d]="edge.path" marker-end="url(#git-parent-arrow)" />
          }
          @for (node of graph().nodes; track node.commit.id) {
            <g
              class="commit-node"
              [class.detached-commit]="node.detached"
              tabindex="0"
              role="button"
              [attr.aria-label]="
                'common.openCommit'
                  | transloco: { id: node.commit.id, message: node.commit.message }
              "
              [attr.data-action]="'commit:' + node.commit.id"
              (click)="inspect.emit(node.commit.id)"
              (keydown)="key($event, node.commit.id)"
            >
              <circle
                [attr.cx]="node.x"
                [attr.cy]="node.y"
                r="11"
                [class]="node.main ? 'node-main' : 'node-feature'"
              />
              <text [attr.x]="node.x" [attr.y]="node.y + 31" text-anchor="middle">
                {{ node.commit.id }}
              </text>
              @if (node.detached) {
                <text [attr.x]="node.x" [attr.y]="node.y + 48" text-anchor="middle">
                  {{ 'commit_graph.outsideBranches' | transloco }}
                </text>
              }
              <text class="ref-label" [attr.x]="node.x" [attr.y]="node.y - 26" text-anchor="middle">
                {{ node.branches }}
              </text>
              @if (node.tracking) {
                <text
                  class="tracking-label"
                  [attr.x]="node.x"
                  [attr.y]="node.y + 50"
                  text-anchor="middle"
                >
                  {{ node.tracking }}
                </text>
              }
              @if (node.current) {
                <text
                  class="head-label"
                  [attr.x]="node.x"
                  [attr.y]="node.y - 43"
                  text-anchor="middle"
                >
                  HEAD → {{ git().head }}
                </text>
              }
            </g>
          }
        </svg>
      </div>
      <div class="graph-footer">
        <span>{{ 'commit_graph.arrowsPointToParentsClickToInspect' | transloco }}</span
        ><span>{{ 'common.graphCount' | transloco: { count: graph().nodes.length } }}</span>
      </div>
    }
  `,
})
export class LearningCommitGraphComponent {
  readonly git = input.required<GitState>();
  readonly inspect = output<string>();
  private readonly canvas = viewChild<ElementRef<HTMLDivElement>>('canvas');
  protected readonly graph = computed(() => {
    const git = this.git(),
      commits = Object.values(git.commits),
      refs = [...Object.values(git.branches), ...Object.values(git.tracking)];
    const width = Math.max(620, commits.length * 130 + 90),
      main = new Set<string>();
    let cursor = git.branches['main'];
    while (cursor && git.commits[cursor] && !main.has(cursor)) {
      main.add(cursor);
      cursor = git.commits[cursor].parents[0];
    }
    const nodes = commits.map((commit, index) => ({
      commit,
      x: 55 + (index * (width - 100)) / Math.max(commits.length - 1, 1),
      y: main.has(commit.id) ? 135 : 55,
      main: main.has(commit.id),
      detached: !refs.some((ref) => isAncestor(git, commit.id, ref)),
      branches: Object.entries(git.branches)
        .filter(([, id]) => id === commit.id)
        .map(([name]) => name)
        .join(' · '),
      tracking: Object.entries(git.tracking)
        .filter(([, id]) => id === commit.id)
        .map(([name]) => 'origin/' + name)
        .join(' · '),
      current: tip(git) === commit.id,
    }));
    const positions = new Map(nodes.map((node) => [node.commit.id, node]));
    const edges = nodes.flatMap((node) =>
      node.commit.parents.flatMap((parent) => {
        const to = positions.get(parent);
        return to
          ? [
              {
                id: node.commit.id + '-' + parent,
                path:
                  'M' +
                  (node.x - 12) +
                  ' ' +
                  node.y +
                  ' C' +
                  (node.x - 48) +
                  ' ' +
                  node.y +
                  ',' +
                  (to.x + 48) +
                  ' ' +
                  to.y +
                  ',' +
                  (to.x + 13) +
                  ' ' +
                  to.y,
              },
            ]
          : [];
      }),
    );
    return { nodes, edges, width, minWidth: Math.max(620, commits.length * 100) };
  });
  private readonly scrollKey = computed(
    () => `${Object.keys(this.git().commits).length}:${tip(this.git())}`,
  );
  constructor() {
    afterRenderEffect({
      earlyRead: () => {
        this.scrollKey();
        const element = this.canvas()?.nativeElement;
        return { element, width: element?.scrollWidth ?? 0 };
      },
      write: (value) => {
        const { element, width } = value();
        if (element) element.scrollLeft = width;
      },
    });
  }
  protected key(event: KeyboardEvent, id: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.inspect.emit(id);
    }
  }
}
