import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { AiGenerationProgressService } from '@core/services/ai-generation-progress.service';
import { AiGenerationProgressBar } from './ai-generation-progress-bar';

describe('AiGenerationProgressBar', () => {
  let fixture: ComponentFixture<AiGenerationProgressBar>;
  let active: ReturnType<typeof signal<boolean>>;
  let background: ReturnType<typeof signal<boolean>>;
  let foregroundActive: ReturnType<typeof signal<boolean>>;
  let stop: jasmine.Spy;
  let sendToBackground: jasmine.Spy;

  beforeEach(async () => {
    active = signal(false);
    background = signal(false);
    foregroundActive = signal(false);
    stop = jasmine.createSpy('stop');
    sendToBackground = jasmine.createSpy('sendToBackground');

    await TestBed.configureTestingModule({
      imports: [AiGenerationProgressBar],
      providers: [
        ...zonelessTestProviders,
        provideRouter([]),
        {
          provide: AiGenerationProgressService,
          useValue: {
            active,
            background,
            foregroundActive,
            progress: signal(42),
            stageLabel: signal('Rédaction…'),
            providerLabel: signal('Groq (cloud)'),
            detail: signal<string | null>(null),
            stop,
            sendToBackground,
            restoreForeground: jasmine.createSpy('restoreForeground'),
            lastError: signal(null),
            dismissLastError: jasmine.createSpy('dismissLastError'),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AiGenerationProgressBar);
  });

  it('hides when inactive', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="ai-generation-progress"]')).toBeNull();
  });

  it('shows stop and background actions when foreground active', () => {
    active.set(true);
    background.set(false);
    foregroundActive.set(true);
    fixture.detectChanges();

    const root = fixture.nativeElement.querySelector('[data-testid="ai-generation-progress"]');
    expect(root).toBeTruthy();

    fixture.nativeElement.querySelector('[data-testid="ai-generation-stop"]').click();
    expect(stop).toHaveBeenCalled();

    fixture.nativeElement.querySelector('[data-testid="ai-generation-background"]').click();
    expect(sendToBackground).toHaveBeenCalled();
  });

  it('hides the full bar in background mode', () => {
    active.set(true);
    background.set(true);
    foregroundActive.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="ai-generation-progress"]')).toBeNull();
  });
});
