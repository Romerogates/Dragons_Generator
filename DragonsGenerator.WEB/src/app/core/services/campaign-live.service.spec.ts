import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HubConnection, HubConnectionState } from '@microsoft/signalr';
import { firstValueFrom, take } from 'rxjs';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { AuthService } from './auth.service';
import {
  CAMPAIGN_LIVE_HUB_FACTORY,
  CampaignLiveService,
  CampaignLiveUpdate,
} from './campaign-live.service';

describe('CampaignLiveService', () => {
  let service: CampaignLiveService;
  let handlers: Record<string, (...args: unknown[]) => void>;
  let invokeSpy: jasmine.Spy;
  let startSpy: jasmine.Spy;
  let stopSpy: jasmine.Spy;
  let state: HubConnectionState;
  let loggedIn = true;
  const userSignal = signal<{ id: string } | null>({ id: 'u1' });

  function buildMockHub(): HubConnection {
    handlers = {};
    invokeSpy = jasmine.createSpy('invoke').and.resolveTo(undefined);
    startSpy = jasmine.createSpy('start').and.callFake(async () => {
      state = HubConnectionState.Connected;
    });
    stopSpy = jasmine.createSpy('stop').and.callFake(async () => {
      state = HubConnectionState.Disconnected;
    });
    state = HubConnectionState.Disconnected;

    return {
      get state() {
        return state;
      },
      on: (event: string, cb: (...args: unknown[]) => void) => {
        handlers[event] = cb;
      },
      onreconnecting: (cb: () => void) => {
        handlers['onreconnecting'] = cb;
      },
      onreconnected: (cb: () => void) => {
        handlers['onreconnected'] = cb;
      },
      onclose: (cb: () => void) => {
        handlers['onclose'] = cb;
      },
      start: () => startSpy(),
      stop: () => stopSpy(),
      invoke: (method: string, ...args: unknown[]) => invokeSpy(method, ...args),
    } as unknown as HubConnection;
  }

  beforeEach(() => {
    loggedIn = true;
    userSignal.set({ id: 'u1' });
    const hub = buildMockHub();
    TestBed.configureTestingModule({
      providers: [
        ...zonelessTestProviders,
        {
          provide: AuthService,
          useValue: {
            user: userSignal.asReadonly(),
            isLoggedIn: () => loggedIn && !!userSignal(),
          },
        },
        { provide: CAMPAIGN_LIVE_HUB_FACTORY, useValue: () => hub },
        CampaignLiveService,
      ],
    });
    service = TestBed.inject(CampaignLiveService);
  });

  afterEach(() => {
    service.ngOnDestroy();
    TestBed.resetTestingModule();
  });

  it('fallbackPollMs depends on connected signal', () => {
    expect(service.fallbackPollMs(4_000)).toBe(4_000);
    expect(service.fallbackPollMs(4_000, 30_000)).toBe(4_000);
  });

  it('watch joins hub and emits filtered updates', async () => {
    await service.watch('camp-1');
    expect(startSpy).toHaveBeenCalled();
    expect(invokeSpy).toHaveBeenCalledWith('JoinCampaign', 'camp-1');
    expect(service.connected()).toBe(true);
    expect(service.fallbackPollMs(4_000)).toBe(30_000);

    const got = firstValueFrom(service.updates('camp-1').pipe(take(1)));
    handlers['campaignUpdated']?.({
      campaignId: 'camp-1',
      updatedAt: '2026-09-10T10:00:00Z',
      reason: 'combat',
    } satisfies CampaignLiveUpdate);
    const evt = await got;
    expect(evt.reason).toBe('combat');

    let other = false;
    const sub = service.updates('camp-1').subscribe(() => {
      other = true;
    });
    handlers['campaignUpdated']?.({ campaignId: 'other', updatedAt: '', reason: 'xp' });
    expect(other).toBe(false);
    sub.unsubscribe();

    handlers['campaignUpdated']?.(null);
    handlers['campaignUpdated']?.({});
  });

  it('ignores watch when logged out', async () => {
    loggedIn = false;
    userSignal.set(null);
    await service.watch('camp-1');
    expect(startSpy).not.toHaveBeenCalled();
  });

  it('ref-counts unwatch and leave', async () => {
    await service.watch('camp-1');
    await service.watch('camp-1');
    await service.unwatch();
    expect(invokeSpy).not.toHaveBeenCalledWith('LeaveCampaign', 'camp-1');
    await service.unwatch();
    expect(invokeSpy).toHaveBeenCalledWith('LeaveCampaign', 'camp-1');
  });

  it('handles start failure then succeeds on retry', async () => {
    startSpy.and.rejectWith(new Error('offline'));
    await service.watch('camp-1');
    expect(service.connected()).toBe(false);

    startSpy.and.callFake(async () => {
      state = HubConnectionState.Connected;
    });
    invokeSpy.and.resolveTo(undefined);
    await service.watch('camp-1');
    expect(service.connected()).toBe(true);
  });

  it('rejoin on onreconnected and clears on onclose', async () => {
    await service.watch('camp-1');
    handlers['onreconnecting']?.();
    expect(service.connected()).toBe(false);
    handlers['onreconnected']?.();
    expect(service.connected()).toBe(true);
    expect(invokeSpy).toHaveBeenCalledWith('JoinCampaign', 'camp-1');
    handlers['onclose']?.();
    expect(service.connected()).toBe(false);
  });

  it('marks disconnected when JoinCampaign fails', async () => {
    invokeSpy.and.rejectWith(new Error('forbidden'));
    await service.watch('camp-1');
    expect(service.connected()).toBe(false);
  });

  it('switches campaign on watch and ignores empty id', async () => {
    await service.watch('camp-1');
    await service.watch('camp-2');
    expect(invokeSpy).toHaveBeenCalledWith('LeaveCampaign', 'camp-1');
    expect(invokeSpy).toHaveBeenCalledWith('JoinCampaign', 'camp-2');
    await service.watch('');
  });

  it('teardown stops hub connection', async () => {
    await service.watch('camp-1');
    service.ngOnDestroy();
    expect(stopSpy).toHaveBeenCalled();
    expect(service.connected()).toBe(false);
  });

  it('swallows leave/stop errors', async () => {
    await service.watch('camp-1');
    invokeSpy.and.rejectWith(new Error('leave fail'));
    stopSpy.and.rejectWith(new Error('stop fail'));
    await service.unwatch();
    service.ngOnDestroy();
  });

  it('rejoin failure on reconnect sets disconnected', async () => {
    await service.watch('camp-1');
    invokeSpy.and.rejectWith(new Error('rejoin fail'));
    handlers['onreconnected']?.();
    await Promise.resolve();
    expect(service.connected()).toBe(false);
  });

  it('concurrent watch shares start promise', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    startSpy.and.callFake(async () => {
      await gate;
      state = HubConnectionState.Connected;
    });
    const a = service.watch('camp-1');
    const b = service.watch('camp-1');
    release();
    await Promise.all([a, b]);
    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(service.connected()).toBe(true);
  });

  it('unwatch no-op when nothing watched', async () => {
    await service.unwatch();
    expect(invokeSpy).not.toHaveBeenCalled();
  });

  it('already connected watch rejoins without restart', async () => {
    await service.watch('camp-1');
    startSpy.calls.reset();
    await service.watch('camp-1');
    expect(startSpy).not.toHaveBeenCalled();
    expect(invokeSpy).toHaveBeenCalledWith('JoinCampaign', 'camp-1');
  });
});
