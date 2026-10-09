import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { NotificationsPage } from './notifications';
import { NotificationService } from '@core/services/notification.service';
import { NotificationPreferencesService } from '@core/services/notification-preferences.service';
import { AuthService } from '@core/services/auth.service';
import type { NotificationItem } from '@core/models/notification.model';

function item(partial: Partial<NotificationItem>): NotificationItem {
  return {
    key: 'k1',
    kind: 'friend_request',
    title: 'Demande',
    message: 'test',
    actionPath: '/friends',
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

describe('NotificationsPage', () => {
  let component: NotificationsPage;
  let fixture: ComponentFixture<NotificationsPage>;
  const items = signal<NotificationItem[]>([]);

  beforeEach(async () => {
    items.set([
      item({
        key: 'xp',
        kind: 'xp_awarded',
        actionPath: '/campaigns/c1?tab=players&levelUp=1',
      }),
    ]);

    await TestBed.configureTestingModule({
      imports: [NotificationsPage],
      providers: [
        ...zonelessTestProviders,
        provideRouter([]),
        { provide: AuthService, useValue: { isLoggedIn: signal(true) } },
        {
          provide: NotificationService,
          useValue: { items, refresh: jasmine.createSpy('refresh') },
        },
        {
          provide: NotificationPreferencesService,
          useValue: {
            isKindEnabled: () => true,
            isDismissed: () => false,
            dismiss: jasmine.createSpy('dismiss'),
            clearDismissed: jasmine.createSpy('clearDismissed'),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('parses actionPath into router commands and query params', () => {
    const n = items()[0];
    expect(component.actionLink(n).commands).toEqual(['/', 'campaigns', 'c1']);
    expect(component.actionQuery(n)).toEqual({ tab: 'players', levelUp: '1' });
  });

  it('maps kinds to destination paths', () => {
    const kinds: { kind: NotificationItem['kind']; path: string; query?: Record<string, string> }[] =
      [
        { kind: 'friend_request', path: '/friends' },
        { kind: 'friend_message', path: '/friends/chat/u2' },
        { kind: 'campaign_invite', path: '/campaigns?invite=i1' },
        { kind: 'character_proposal', path: '/campaigns/c1?tab=players' },
        { kind: 'support_reply', path: '/support?ticket=t1' },
        { kind: 'schedule_rsvp', path: '/campaigns/c1?tab=calendar' },
      ];
    for (const row of kinds) {
      const n = item({ kind: row.kind, actionPath: row.path });
      const link = component.actionLink(n);
      expect(link.commands[1]).toBe(row.path.split('/')[1].split('?')[0]);
      if (row.path.includes('?')) {
        expect(component.actionQuery(n)).toBeTruthy();
      }
    }
  });

  it('counts site announcements in "Tout" and gives them a megaphone icon', () => {
    items.set([
      item({ key: 'announcement-a1', kind: 'announcement', actionPath: '/notifications?announcement=a1' }),
      item({ key: 'f1', kind: 'friend_request' }),
    ]);
    fixture.detectChanges();
    expect(component.announcementsCount()).toBe(1);
    expect(component.iconFor('announcement')).toBe('fluent-emoji:loudspeaker');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Tout (2)');

    component.setFilter('friends');
    expect(component.visibleItems().map((i) => i.key)).toEqual(['f1']);
    component.setFilter('all');
    expect(component.visibleItems().length).toBe(2);
  });
});
