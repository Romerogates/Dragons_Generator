import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { SiteFooterComponent } from './site-footer';
import { APP_VERSION } from '@env/app-version';

describe('SiteFooterComponent', () => {
  it('shows the build version', async () => {
    await TestBed.configureTestingModule({
      imports: [SiteFooterComponent],
      providers: [...zonelessTestProviders, provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(SiteFooterComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain(`v${APP_VERSION}`);
  });
});
