import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { GuideIndexPage } from './guide-index';
import { GUIDE_CLASS_PLAYBOOKS } from './guide-class-playbooks';
import { GUIDE_SUBCLASS_PLAYBOOKS } from './guide-subclass-playbooks';
import { GUIDE_SPECIES_PLAYBOOKS } from './guide-species-playbooks';

describe('GuideIndexPage', () => {
  let fixture: ComponentFixture<GuideIndexPage>;
  let component: GuideIndexPage;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GuideIndexPage],
      providers: [
        ...zonelessTestProviders,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GuideIndexPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and expose playbooks', () => {
    expect(component).toBeTruthy();
    expect(component.classPlaybooks.length).toBe(GUIDE_CLASS_PLAYBOOKS.length);
    expect(component.subclassPlaybooks.length).toBe(GUIDE_SUBCLASS_PLAYBOOKS.length);
    expect(component.speciesPlaybooks.length).toBe(GUIDE_SPECIES_PLAYBOOKS.length);
  });

  it('renders hub heading Guide', () => {
    const h1 = fixture.nativeElement.querySelector('h1');
    expect(h1?.textContent?.trim()).toBe('Guide');
  });
});
