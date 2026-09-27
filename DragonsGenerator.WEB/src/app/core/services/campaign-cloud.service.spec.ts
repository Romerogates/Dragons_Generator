import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { signal } from '@angular/core';
import { AuthService } from './auth.service';
import { CampaignCloudService } from './campaign-cloud.service';
import { environment } from '../../../environments/environment';

describe('CampaignCloudService', () => {
  let service: CampaignCloudService;
  let http: HttpTestingController;
  const loggedIn = signal(true);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...zonelessTestProviders,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            isLoggedIn: () => loggedIn(),
          },
        },
      ],
    });
    service = TestBed.inject(CampaignCloudService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('normalizes scheduleEvents / atlasPins / notebook on get()', () => {
    let detail: ReturnType<CampaignCloudService['get']> extends import('rxjs').Observable<infer T>
      ? T
      : never;
    service.get('camp-1').subscribe((d) => (detail = d));

    const req = http.expectOne(`${environment.apiUrl}/me/campaigns/camp-1`);
    req.flush({
      id: 'camp-1',
      title: 'Test',
      role: 'dm',
      isOwner: true,
      updatedAt: '2026-09-27T10:00:00.000Z',
      members: [],
      data: {
        setting: 'Eana',
        scheduleEvents: [
          {
            id: 'e1',
            title: 'Soirée',
            startsAt: '2026-10-01T18:00:00.000Z',
            endsAt: '2026-10-01T21:00:00.000Z',
            kind: 'game',
          },
        ],
        atlasPins: [{ id: 'p1', name: 'Cité Franche' }],
        notebookPages: [{ id: 'n1', title: 'Notes', text: 'x', mode: 'text', updatedAt: '2026-09-27T10:00:00.000Z' }],
        handouts: [{ id: 'h1', title: 'Doc', body: '', kind: 'weird', published: true }],
      },
    });

    expect(detail!.data.scheduleEvents?.length).toBe(1);
    expect(detail!.data.scheduleEvents?.[0].title).toBe('Soirée');
    expect(detail!.data.atlasPins?.length).toBe(1);
    expect(detail!.data.notebookPages?.length).toBe(1);
    expect(detail!.data.handouts[0].kind).toBe('other');
  });

  it('defaults missing arrays when data is empty', () => {
    let detail: { data: { scheduleEvents?: unknown[]; sessions: unknown[] } } | undefined;
    service.get('camp-2').subscribe((d) => (detail = d));
    http.expectOne(`${environment.apiUrl}/me/campaigns/camp-2`).flush({
      id: 'camp-2',
      title: 'Empty',
      role: 'player',
      isOwner: false,
      updatedAt: '2026-09-27T10:00:00.000Z',
      members: [],
      data: null,
    });
    expect(detail!.data.scheduleEvents).toEqual([]);
    expect(detail!.data.sessions).toEqual([]);
  });

  it('posts schedule RSVP', () => {
    service.setScheduleRsvp('c1', 'e1', 'yes').subscribe();
    const req = http.expectOne(`${environment.apiUrl}/me/campaigns/c1/schedule/e1/rsvp`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ status: 'yes' });
    req.flush([]);
  });

  it('joins as spectator', () => {
    service.joinAsSpectator('tok').subscribe();
    const req = http.expectOne(`${environment.apiUrl}/me/join/tok/spectator`);
    expect(req.request.method).toBe('POST');
    req.flush({ id: 'c', title: 'T', role: 'spectator', updatedAt: '', playerCount: 0 });
  });
});
