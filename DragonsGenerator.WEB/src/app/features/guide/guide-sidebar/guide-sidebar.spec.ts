import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { GuideSidebar } from './guide-sidebar';

describe('GuideSidebar', () => {
  let fixture: ComponentFixture<GuideSidebar>;
  let sidebar: GuideSidebar;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GuideSidebar],
      providers: [...zonelessTestProviders, provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(GuideSidebar);
    sidebar = fixture.componentInstance;
    fixture.componentRef.setInput('sections', []);
    fixture.detectChanges();
  });

  it('starts with nav closed on mobile and can toggle', () => {
    expect(sidebar.navOpen()).toBe(false);
    sidebar.navOpen.set(true);
    expect(sidebar.navOpen()).toBe(true);
    sidebar.closeNavOnMobile();
    expect(sidebar.navOpen()).toBe(false);
  });

  it('hides the outline on the hub', () => {
    fixture.componentRef.setInput('showOutline', false);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('Sommaire');
  });

  it('linkClass distinguishes active state', () => {
    expect(sidebar.linkClass(true)).toContain('amber');
    expect(sidebar.linkClass(false)).toContain('slate');
  });

  it('exposes class playbooks for the sidebar list', () => {
    expect(sidebar.classPlaybooks.length).toBe(13);
  });
});
