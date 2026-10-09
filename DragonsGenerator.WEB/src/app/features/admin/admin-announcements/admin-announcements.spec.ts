import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { SiteAnnouncementService } from '@core/services/site-announcement.service';
import type { SiteAnnouncement } from '@core/models/site-announcement.model';
import { AdminAnnouncements } from './admin-announcements';

const sample: SiteAnnouncement = {
  id: 'a1',
  title: 'Information',
  message: 'Nouvelle carte',
  severity: 'info',
  startsAt: '2026-10-09T10:00:00Z',
  endsAt: '2026-10-10T10:00:00Z',
  createdAt: '2026-10-09T10:00:00Z',
  active: true,
};

describe('AdminAnnouncements', () => {
  let service: jasmine.SpyObj<SiteAnnouncementService>;

  async function create(list: SiteAnnouncement[] = [sample]) {
    service = jasmine.createSpyObj<SiteAnnouncementService>('SiteAnnouncementService', [
      'listAll',
      'create',
      'end',
      'remove',
    ]);
    service.listAll.and.returnValue(of(list));
    await TestBed.configureTestingModule({
      imports: [AdminAnnouncements],
      providers: [...zonelessTestProviders, { provide: SiteAnnouncementService, useValue: service }],
    }).compileComponents();
    const fixture = TestBed.createComponent(AdminAnnouncements);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('lists history with severity label and state', async () => {
    const fixture = await create([sample, { ...sample, id: 'a2', severity: 'outage', active: false }]);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Nouvelle carte');
    expect(text).toContain('En ligne');
    expect(text).toContain('Terminée');
    expect(text).toContain('Panne / incident');
  });

  it('shows the empty state and load errors', async () => {
    const fixture = await create([]);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Aucune annonce publiée');

    service.listAll.and.returnValue(throwError(() => new Error('x')));
    fixture.componentInstance.load();
    expect(fixture.componentInstance.error()).toContain('Impossible de charger');
  });

  it('validates message length and duration before submitting', async () => {
    const fixture = await create();
    const c = fixture.componentInstance;
    c.body = 'ok';
    expect(c.canSubmit()).toBeFalse();
    c.body = 'Maintenance ce soir';
    c.durationDays = 0;
    expect(c.canSubmit()).toBeFalse();
    c.durationDays = 1.5;
    expect(c.canSubmit()).toBeFalse();
    c.durationDays = 3;
    expect(c.canSubmit()).toBeTrue();
    c.body = '';
    c.submit();
    expect(service.create).not.toHaveBeenCalled();
  });

  it('publishes, resets the form and reloads', async () => {
    const fixture = await create();
    const c = fixture.componentInstance;
    service.create.and.returnValue(of(sample));
    c.title = '  ';
    c.body = '  Panne IA  ';
    c.severity = 'outage';
    c.durationDays = 2;
    c.submit();
    expect(service.create).toHaveBeenCalledWith({
      title: null,
      message: 'Panne IA',
      severity: 'outage',
      durationDays: 2,
    });
    expect(c.body).toBe('');
    expect(c.message()).toContain('publiée');
    expect(service.listAll).toHaveBeenCalledTimes(2);
  });

  it('surfaces API validation errors on publish', async () => {
    const fixture = await create();
    const c = fixture.componentInstance;
    c.body = 'Message valide';
    service.create.and.returnValue(
      throwError(() => ({ error: { errors: { generalErrors: ['Durée invalide'] } } })),
    );
    c.submit();
    expect(c.error()).toBe('Durée invalide');
    expect(c.saving()).toBeFalse();

    service.create.and.returnValue(throwError(() => ({})));
    c.submit();
    expect(c.error()).toBe('Publication impossible.');
  });

  it('ends and removes announcements', async () => {
    const fixture = await create();
    const c = fixture.componentInstance;
    service.end.and.returnValue(of({ ...sample, active: false }));
    c.end(sample);
    expect(c.message()).toBe('Annonce terminée.');

    service.end.and.returnValue(throwError(() => new Error('x')));
    c.end(sample);
    expect(c.error()).toContain('terminer');

    spyOn(window, 'confirm').and.returnValues(false, true, true);
    service.remove.and.returnValue(of(undefined));
    c.remove(sample);
    expect(service.remove).not.toHaveBeenCalled();
    c.remove(sample);
    expect(c.message()).toBe('Annonce supprimée.');

    service.remove.and.returnValue(throwError(() => new Error('x')));
    c.remove(sample);
    expect(c.error()).toBe('Suppression impossible.');
  });
});
