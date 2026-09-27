import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { AI_GENERATION_BUSY } from '@core/models/ai-generation.model';
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

  afterEach(() => {
    service.stop();
    service.dismissToast();
  });

  it('activates progress with provider label from ai status', async () => {
    await service.begin('creature-backstory');
    expect(service.active()).toBeTrue();
    expect(service.foregroundActive()).toBeTrue();
    expect(service.providerLabel()).toBe('Ollama (local)');
    expect(service.stageLabel()).toContain('Génération');
    service.cancel();
    expect(service.active()).toBeFalse();
  });

  it('completes an observable run and calls onSuccess', (done) => {
    const onSuccess = jasmine.createSpy('onSuccess');
    service
      .run('character-backstory', () => of({ story: 'Test' }), { onSuccess })
      .subscribe({
        next: (res) => {
          expect(res.story).toBe('Test');
          expect(onSuccess).toHaveBeenCalledWith({ story: 'Test' });
          done();
        },
      });
  });

  it('rejects a second run while active', (done) => {
    const gate = new Subject<{ story: string }>();
    service.run('adventure', () => gate.asObservable()).subscribe({ error: () => undefined });

    service.run('adventure', () => of({ story: 'nope' })).subscribe({
      error: (err) => {
        expect(err.code).toBe(AI_GENERATION_BUSY);
        done();
      },
    });
  });

  it('stop() aborts without calling onSuccess', (done) => {
    const gate = new Subject<{ adventure: string }>();
    const onSuccess = jasmine.createSpy('onSuccess');

    service.run('adventure', () => gate.asObservable(), { onSuccess }).subscribe({
      next: () => fail('should not emit'),
      complete: () => {
        expect(onSuccess).not.toHaveBeenCalled();
        expect(service.isAborted()).toBeTrue();
        done();
      },
    });

    queueMicrotask(() => service.stop());
  });

  it('sendToBackground hides the bar but keeps the request and toasts on success', (done) => {
    const gate = new Subject<{ adventure: string }>();
    const onSuccess = jasmine.createSpy('onSuccess');

    service
      .run('adventure', () => gate.asObservable(), {
        onSuccess,
        readyMessage: 'Aventure prête',
      })
      .subscribe({ error: () => undefined });

    setTimeout(() => {
      expect(service.foregroundActive()).toBeTrue();
      service.sendToBackground();
      expect(service.background()).toBeTrue();
      expect(service.foregroundActive()).toBeFalse();
      expect(service.active()).toBeTrue();

      gate.next({ adventure: 'Once upon a time' });
      gate.complete();

      setTimeout(() => {
        expect(onSuccess).toHaveBeenCalledWith({ adventure: 'Once upon a time' });
        expect(service.toastMessage()).toBe('Aventure prête');
        expect(service.active()).toBeFalse();
        done();
      }, 30);
    }, 20);
  });

  it('does not abort when sent to background', (done) => {
    const gate = new Subject<{ story: string }>();
    let emitted = false;

    service.run('character-backstory', () => gate.asObservable()).subscribe({
      next: () => {
        emitted = true;
      },
      complete: () => {
        expect(emitted).toBeTrue();
        done();
      },
    });

    setTimeout(() => {
      service.sendToBackground();
      gate.next({ story: 'ok' });
      gate.complete();
    }, 20);
  });

  it('awaitWhileActive rejects when stop() is called', async () => {
    const gate = new Subject<string>();
    await service.begin('pregen-hero');
    const pending = service.awaitWhileActive(gate.asObservable());
    queueMicrotask(() => service.stop());
    await expectAsync(pending).toBeRejected();
    expect(service.isAborted()).toBeTrue();
  });
});
