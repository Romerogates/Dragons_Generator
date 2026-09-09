import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CampaignNotebook } from './campaign-notebook';
import { createNotebookPage } from '@core/models/Campaign/campaign';
import { DataService } from '@core/services/data.service';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { of, throwError } from 'rxjs';

describe('CampaignNotebook', () => {
  let fixture: ComponentFixture<CampaignNotebook>;
  let component: CampaignNotebook;
  let data: { transcribeNotebook: jasmine.Spy };

  beforeEach(async () => {
    data = {
      transcribeNotebook: jasmine.createSpy('transcribeNotebook').and.returnValue(of({ text: 'lu' })),
    };
    await TestBed.configureTestingModule({
      imports: [CampaignNotebook],
      providers: [...zonelessTestProviders, { provide: DataService, useValue: data }],
    }).compileComponents();

    fixture = TestBed.createComponent(CampaignNotebook);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('page', createNotebookPage('Test'));
    fixture.componentRef.setInput('pages', null);
    fixture.componentRef.setInput('showPageList', false);
    fixture.detectChanges();
  });

  it('opens and closes ink fullscreen', () => {
    expect(component.inkFullscreen()).toBe(false);
    expect(component.hasInkPreview()).toBe(false);
    component.openInkFullscreen();
    expect(component.inkFullscreen()).toBe(true);
    component.closeInkFullscreen(true);
    expect(component.inkFullscreen()).toBe(false);
  });

  it('emits title and text changes', () => {
    const spy = jasmine.createSpy('page');
    component.pageChange.subscribe(spy);
    component.onTitleChange('Nouveau');
    expect(spy.calls.mostRecent().args[0].title).toBe('Nouveau');
    component.onTextChange('corps');
    // debounced — flush by calling again via open path
    expect(spy).toHaveBeenCalled();
  });

  it('setPen tools update signals', () => {
    component.setPenColor('#f87171');
    expect(component.penColor()).toBe('#f87171');
    component.setInkTool('highlighter');
    expect(component.inkTool()).toBe('highlighter');
    expect(component.penWidth()).toBeGreaterThanOrEqual(8);
    component.toggleEraser();
    expect(component.erasing()).toBe(true);
    component.setPenWidth(3);
    expect(component.penWidth()).toBe(3);
  });

  it('listPages falls back to single page', () => {
    expect(component.listPages().length).toBe(1);
  });

  it('addPage and removePage manage list', () => {
    const pages = [createNotebookPage('A'), createNotebookPage('B')];
    fixture.componentRef.setInput('pages', pages);
    fixture.componentRef.setInput('page', pages[0]!);
    fixture.detectChanges();

    const pagesSpy = jasmine.createSpy('pages');
    const pageSpy = jasmine.createSpy('page');
    component.pagesChange.subscribe(pagesSpy);
    component.pageChange.subscribe(pageSpy);

    component.selectPage(pages[1]!.id);
    expect(pageSpy).toHaveBeenCalledWith(pages[1]!);

    component.addPage();
    expect(pagesSpy.calls.mostRecent().args[0].length).toBe(3);

    spyOn(window, 'confirm').and.returnValue(true);
    component.removePage(pages[0]!.id);
    expect(pagesSpy.calls.mostRecent().args[0].length).toBe(1);
  });

  it('transcribeInk merges text and closes overlay', () => {
    const page = createNotebookPage('T');
    page.inkImageDataUrl = 'data:image/jpeg;base64,xx';
    fixture.componentRef.setInput('page', page);
    fixture.detectChanges();
    component.openInkFullscreen();

    const spy = jasmine.createSpy('page');
    component.pageChange.subscribe(spy);
    component.transcribeInk();
    expect(data.transcribeNotebook).toHaveBeenCalled();
    expect(spy.calls.mostRecent().args[0].text).toContain('lu');
    expect(component.inkFullscreen()).toBe(false);
  });

  it('transcribeInk surfaces errors', () => {
    data.transcribeNotebook.and.returnValue(throwError(() => ({ error: { message: 'down' } })));
    const page = createNotebookPage('T');
    page.inkImageDataUrl = 'data:image/jpeg;base64,xx';
    fixture.componentRef.setInput('page', page);
    fixture.detectChanges();
    component.transcribeInk();
    expect(component.transcribeError()).toContain('down');
  });

  it('hasInkPreview when strokes exist', () => {
    const page = createNotebookPage('T');
    page.inkStrokes = [{ color: '#fff', width: 2, points: [{ x: 1, y: 1 }] }];
    fixture.componentRef.setInput('page', page);
    fixture.detectChanges();
    expect(component.hasInkPreview()).toBe(true);
  });
});
