import { ChangeDetectionStrategy, Component } from '@angular/core';
import { EVENT_BRAND } from '../event-brand';

@Component({
  selector: 'app-event-partners',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="partners" aria-label="Event sponsor, venue, and organizer">
    @for (partner of partners; track partner.kind) {
      <div class="partner" [class]="'partner ' + partner.kind">
        <span class="role">{{ partner.role }}</span>
        <div class="identity">
          <img [src]="partner.logo" [alt]="partner.name" />
          @if (partner.kind === 'venue') {
            <span>University<br />of Jordan</span>
          }
        </div>
      </div>
    }
  </section>`,
  styleUrl: './event-partners.component.scss',
})
export class EventPartnersComponent {
  protected readonly partners = EVENT_BRAND.partners;
}
