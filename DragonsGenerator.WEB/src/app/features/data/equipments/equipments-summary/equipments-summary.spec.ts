import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EquipmentsSummary } from './equipments-summary';

describe('EquipmentsSummary', () => {
  let component: EquipmentsSummary;
  let fixture: ComponentFixture<EquipmentsSummary>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EquipmentsSummary]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EquipmentsSummary);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
