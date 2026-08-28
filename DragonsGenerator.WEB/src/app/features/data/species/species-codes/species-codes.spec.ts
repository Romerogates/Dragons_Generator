import { ComponentFixture, TestBed } from '@angular/core/testing';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';

import { SpeciesCodes } from './species-codes';

describe('SpeciesCodes', () => {
  let component: SpeciesCodes;
  let fixture: ComponentFixture<SpeciesCodes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpeciesCodes],
      providers: zonelessTestProviders,
    }).compileComponents();

    fixture = TestBed.createComponent(SpeciesCodes);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
