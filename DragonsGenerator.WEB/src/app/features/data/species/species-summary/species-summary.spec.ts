import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SpeciesSummary } from './species-summary';

describe('SpeciesSummary', () => {
  let component: SpeciesSummary;
  let fixture: ComponentFixture<SpeciesSummary>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpeciesSummary]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SpeciesSummary);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
