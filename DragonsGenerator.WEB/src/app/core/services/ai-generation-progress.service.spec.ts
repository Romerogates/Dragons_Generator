import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { AiGenerationProgressService } from './ai-generation-progress.service';
import { AiStatusService } from './ai-status.service';

describe('AiGenerationProgressService', () => {
  let service: AiGenerationProgressService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...zonelessTestProviders,
        AiGenerationProgressService,
        {
          provide: AiStatusService,
          useValue: {
            getStatus: () =>
              of({
                localLlmEnabled: true,
                groqConfigured: true,
                shortGeneration: {
                  primary: 'ollama',
                  fallback: 'groq',
                  primaryLabel: 'Ollama (local)',
                  fallbackLabel: 'Groq (cloud)',
                },
                adventureGeneration: {
                  primary: 'groq',
                  fallback: 'ollama',
                  primaryLabel: 'Groq (cloud)',
                  fallbackLabel: 'Ollama (local)',
                },
              }),
          },
        },
      ],
    });
    service = TestBed.inject(AiGenerationProgressService);
  });

  it('activates progress with provider label from ai status', async () => {
    await service.begin('creature-backstory');
    expect(service.active()).toBeTrue();
    expect(service.providerLabel()).toBe('Ollama (local)');
    expect(service.stageLabel()).toContain('Génération');
    service.cancel();
    expect(service.active()).toBeFalse();
  });

  it('completes an observable run', (done) => {
    service.run('character-backstory', () => of({ story: 'Test' })).subscribe({
      next: (res) => {
        expect(res.story).toBe('Test');
        done();
      },
    });
  });
});
