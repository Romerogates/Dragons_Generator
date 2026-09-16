import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap, provideRouter, ActivatedRoute } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { signal } from '@angular/core';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { GuideRulebookPdfService } from '@core/services/guide-rulebook-pdf.service';
import { GuidePreferencesService } from '@core/services/guide-preferences.service';
import { GuideRulebookPage } from './guide-rulebook';

describe('GuideRulebookPage', () => {
  let fixture: ComponentFixture<GuideRulebookPage>;
  let page: GuideRulebookPage;
  let paramMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let snapshotData: Record<string, string>;
  let pdf: { download: jasmine.Spy };
  let prefs: { audience: ReturnType<typeof signal>; setAudience: jasmine.Spy };

  async function setup(
    initialParams: Record<string, string> = {},
    data: Record<string, string> = {},
    audiencePref: 'all' | 'dm' | 'player' = 'all',
  ): Promise<void> {
    paramMap$ = new BehaviorSubject(convertToParamMap(initialParams));
    snapshotData = data;
    pdf = { download: jasmine.createSpy('download').and.resolveTo(undefined) };
    prefs = {
      audience: signal(audiencePref),
      setAudience: jasmine.createSpy('setAudience'),
    };

    await TestBed.configureTestingModule({
      imports: [GuideRulebookPage],
      providers: [
        ...zonelessTestProviders,
        provideRouter([]),
        { provide: GuideRulebookPdfService, useValue: pdf },
        { provide: GuidePreferencesService, useValue: prefs },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: paramMap$.asObservable(),
            snapshot: { data: snapshotData },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GuideRulebookPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('loads mj-table rulebook and sets dm audience', async () => {
    await setup({}, { rulebookId: 'mj-table' });
    expect(page.book()?.id).toBe('mj-table');
    expect(page.classBook()).toBeNull();
    expect(page.displayTitle()).toContain('MJ');
    expect(page.showBeginnerPack()).toBe(false);
    expect(page.activeRulebookId()).toBe('mj-table');
    expect(prefs.setAudience).toHaveBeenCalledWith('dm');
    expect(page.audience()).toBe('dm');
  });

  it('loads class playbook with pack CTA and related links', async () => {
    await setup({ classId: 'cls-barbare' }, {}, 'player');
    expect(page.classBook()?.classId).toBe('cls-barbare');
    expect(page.book()).toBeNull();
    expect(page.showBeginnerPack()).toBe(true);
    expect(page.related().some((r) => r.path === '/classes/cls-barbare')).toBe(true);
    expect(page.displayChapters().length).toBeGreaterThan(0);
    expect(page.audience()).toBe('player');
  });

  it('downloads PDF for a rulebook and ignores while exporting', async () => {
    await setup({}, { rulebookId: 'joueur-table' });
    await page.downloadPdf();
    expect(pdf.download).toHaveBeenCalled();
    expect(page.exporting()).toBe(false);

    page.exporting.set(true);
    pdf.download.calls.reset();
    await page.downloadPdf();
    expect(pdf.download).not.toHaveBeenCalled();
  });

  it('sets export error when PDF download fails', async () => {
    await setup({}, { rulebookId: 'joueur-table' });
    pdf.download.and.rejectWith(new Error('fail'));
    await page.downloadPdf();
    expect(page.exportError()).toContain('impossible');
    expect(page.exporting()).toBe(false);
  });

  it('downloads beginner pack for a class and reports errors', async () => {
    await setup({ classId: 'cls-barbare' });
    await page.downloadBeginnerPack();
    expect(pdf.download).toHaveBeenCalled();
    const arg = pdf.download.calls.mostRecent().args[0];
    expect(arg.pdfFilename).toBe('dragons-pack-debutant-barbare.pdf');
    expect(arg.chapters.length).toBeGreaterThan(page.classBook()!.chapters.length);

    pdf.download.and.rejectWith(new Error('fail'));
    await page.downloadBeginnerPack();
    expect(page.exportError()).toContain('pack');

    page.classBook.set(null);
    pdf.download.calls.reset();
    await page.downloadBeginnerPack();
    expect(pdf.download).not.toHaveBeenCalled();
  });

  it('switches from class to joueur rulebook via paramMap', async () => {
    await setup({ classId: 'cls-magicien' });
    expect(page.classBook()?.classId).toBe('cls-magicien');

    snapshotData['rulebookId'] = 'joueur-en-ligne';
    paramMap$.next(convertToParamMap({}));
    fixture.detectChanges();

    expect(page.classBook()).toBeNull();
    expect(page.book()?.id).toBe('joueur-en-ligne');
    expect(prefs.setAudience).toHaveBeenCalledWith('player');
  });

  it('marks search empty when query has no match', async () => {
    await setup({}, { rulebookId: 'mj-table' });
    page.navQuery.set('zzz-no-match-xyz');
    expect(page.searchEmpty()).toBe(true);
    page.navQuery.set('');
    expect(page.searchEmpty()).toBe(false);
  });
});
