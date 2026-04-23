import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CharacterClassDetail } from './character-class-detail';

describe('CharacterClassDetail', () => {
  let component: CharacterClassDetail;
  let fixture: ComponentFixture<CharacterClassDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CharacterClassDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CharacterClassDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
