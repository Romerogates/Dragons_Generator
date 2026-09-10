import { Location } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';

import { CodexDetailShell } from './codex-detail-shell';

describe('CodexDetailShell', () => {
  let component: CodexDetailShell;
  let fixture: ComponentFixture<CodexDetailShell>;
  let location: Location;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CodexDetailShell],
      providers: [...zonelessTestProviders, provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(CodexDetailShell);
    component = fixture.componentInstance;
    location = TestBed.inject(Location);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('close() navigates via Location.back when history.length > 1', () => {
    const backSpy = spyOn(location, 'back');
    Object.defineProperty(window.history, 'length', { configurable: true, value: 2 });

    component.close();

    expect(backSpy).toHaveBeenCalled();
  });
});
