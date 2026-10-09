import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { environment } from '@env/environment';
import type { SiteAnnouncement } from '@core/models/site-announcement.model';
import { SiteAnnouncementService } from './site-announcement.service';

const KEY = 'dragons-announcements-dismissed';

function ann(id: string, overrides: Partial<SiteAnnouncement> = {}): SiteAnnouncement {
  return {
    id,
    title: 'Incident en cours',
    message: 'Maintenance',
    severity: 'outage',
    startsAt: '2026-10-09T10:00:00Z',
    endsAt: '2026-10-10T10:00:00Z',
    createdAt: '2026-10-09T10:00:00Z',
    active: true,
    ...overrides,
  };
}

describe('SiteAnnouncementService', () => {
  let http: HttpTestingController;
  const api = environment.apiUrl;

  function setup(): SiteAnnouncementService {
    TestBed.configureTestingModule({
      providers: [...zonelessTestProviders, provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(SiteAnnouncementService);
  }

  beforeEach(() => localStorage.removeItem(KEY));
  afterEach(() => {
    http.verify();
    localStorage.removeItem(KEY);
  });

  it('loads active announcements and hides dismissed ones', () => {
    const service = setup();
    service.refresh();
    http.expectOne(`${api}/announcements/active`).flush([ann('a'), ann('b')]);
    expect(service.visible().map((a) => a.id)).toEqual(['a', 'b']);

    service.dismiss('a');
    expect(service.isDismissed('a')).toBeTrue();
    expect(service.visible().map((a) => a.id)).toEqual(['b']);
    expect(JSON.parse(localStorage.getItem(KEY) ?? '[]')).toEqual(['a']);
  });

  it('restores dismissals and prunes ids that are no longer active', () => {
    localStorage.setItem(KEY, JSON.stringify(['old', 'b', 42]));
    const service = setup();
    service.refresh();
    http.expectOne(`${api}/announcements/active`).flush([ann('b'), ann('c')]);
    expect(service.visible().map((a) => a.id)).toEqual(['c']);
    expect(JSON.parse(localStorage.getItem(KEY) ?? '[]')).toEqual(['b']);
  });

  it('keeps storage untouched when nothing needs pruning', () => {
    localStorage.setItem(KEY, JSON.stringify(['b']));
    const service = setup();
    const spy = spyOn(localStorage, 'setItem').and.callThrough();
    service.refresh();
    http.expectOne(`${api}/announcements/active`).flush([ann('b')]);
    expect(spy).not.toHaveBeenCalled();
  });

  it('tolerates corrupt storage and non-array payloads', () => {
    localStorage.setItem(KEY, '{not json');
    const service = setup();
    service.refresh();
    http.expectOne(`${api}/announcements/active`).flush({ nope: true });
    expect(service.active()).toEqual([]);
  });

  it('clears the list on error', () => {
    const service = setup();
    service.refresh();
    http.expectOne(`${api}/announcements/active`).flush([ann('a')]);
    service.refresh();
    http
      .expectOne(`${api}/announcements/active`)
      .flush(null, { status: 502, statusText: 'Bad Gateway' });
    expect(service.active()).toEqual([]);
  });

  it('init polls once immediately and only registers once', () => {
    const service = setup();
    const addSpy = spyOn(window, 'addEventListener').and.callThrough();
    service.init();
    http.expectOne(`${api}/announcements/active`).flush([]);
    service.init();
    http.expectOne(`${api}/announcements/active`).flush([]);
    expect(addSpy.calls.allArgs().filter((a) => a[0] === 'focus').length).toBe(1);

    window.dispatchEvent(new Event('focus'));
    http.expectOne(`${api}/announcements/active`).flush([]);
  });

  it('admin calls hit the admin endpoints and refresh the banner', () => {
    const service = setup();

    service.listAll().subscribe();
    http.expectOne(`${api}/admin/announcements`).flush([]);

    service.create({ message: 'Panne', severity: 'outage', durationDays: 2 }).subscribe();
    const create = http.expectOne(`${api}/admin/announcements`);
    expect(create.request.method).toBe('POST');
    create.flush(ann('n'));
    http.expectOne(`${api}/announcements/active`).flush([ann('n')]);

    service.end('n').subscribe();
    const end = http.expectOne(`${api}/admin/announcements/n/end`);
    expect(end.request.method).toBe('POST');
    end.flush(ann('n', { active: false }));
    http.expectOne(`${api}/announcements/active`).flush([]);

    service.remove('n').subscribe();
    const del = http.expectOne(`${api}/admin/announcements/n`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
    http.expectOne(`${api}/announcements/active`).flush([]);
  });

  it('survives a storage write failure', () => {
    const service = setup();
    spyOn(localStorage, 'setItem').and.throwError('quota');
    expect(() => service.dismiss('x')).not.toThrow();
    expect(service.isDismissed('x')).toBeTrue();
  });
});
