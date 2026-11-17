import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { isUpdateSnoozed, PWA_UPDATE_SNOOZE_KEY, snoozeUpdate } from '@core/utils/pwa-update.util';
import { PwaLifecycleService } from './pwa-lifecycle.service';

describe('PwaLifecycleService', () => {
  let versionUpdates: Subject<VersionReadyEvent>;
  let unrecoverable: Subject<{ reason: string }>;
  let checkForUpdate: jasmine.Spy;
  let activateUpdate: jasmine.Spy;

  function setup(opts?: { platform?: unknown; swEnabled?: boolean }): PwaLifecycleService {
    versionUpdates = new Subject<VersionReadyEvent>();
    unrecoverable = new Subject<{ reason: string }>();
    checkForUpdate = jasmine.createSpy('checkForUpdate').and.resolveTo(true);
    activateUpdate = jasmine.createSpy('activateUpdate').and.resolveTo(true);
    TestBed.configureTestingModule({
      providers: [
        ...zonelessTestProviders,
        { provide: PLATFORM_ID, useValue: opts?.platform ?? 'browser' },
        {
          provide: SwUpdate,
          useValue: {
            isEnabled: opts?.swEnabled ?? true,
            versionUpdates: versionUpdates.asObservable(),
            unrecoverable: unrecoverable.asObservable(),
            checkForUpdate,
            activateUpdate,
          },
        },
        PwaLifecycleService,
      ],
    });
    return TestBed.inject(PwaLifecycleService);
  }

  beforeEach(() => {
    localStorage.removeItem(PWA_UPDATE_SNOOZE_KEY);
  });

  afterEach(() => {
    localStorage.removeItem(PWA_UPDATE_SNOOZE_KEY);
    TestBed.resetTestingModule();
  });

  it('does nothing on the server', () => {
    const pwa = setup({ platform: 'server' });
    pwa.init();
    expect(checkForUpdate).not.toHaveBeenCalled();
  });

  it('init is idempotent and polls the service worker', async () => {
    const pwa = setup();
    pwa.init();
    pwa.init();
    expect(checkForUpdate).toHaveBeenCalledTimes(1);
    await Promise.resolve();
  });

  it('shows the banner when a version is ready', () => {
    const pwa = setup();
    pwa.init();
    versionUpdates.next({ type: 'VERSION_READY', currentVersion: { hash: 'a' }, latestVersion: { hash: 'b' } });
    expect(pwa.updateReady()).toBeTrue();
  });

  it('keeps the banner hidden while snoozed', () => {
    snoozeUpdate();
    const pwa = setup();
    pwa.init();
    versionUpdates.next({ type: 'VERSION_READY', currentVersion: { hash: 'a' }, latestVersion: { hash: 'b' } });
    expect(pwa.updateReady()).toBeFalse();
  });

  it('snoozes the update banner for later', () => {
    const pwa = setup({ swEnabled: false });
    pwa.updateReady.set(true);
    pwa.dismissUpdate();
    expect(pwa.updateReady()).toBeFalse();
    expect(isUpdateSnoozed()).toBeTrue();
  });

  it('promptInstall returns false without a deferred prompt', async () => {
    const pwa = setup({ swEnabled: false });
    expect(await pwa.promptInstall()).toBeFalse();
  });

  it('promptInstall accepts a deferred prompt', async () => {
    const pwa = setup({ swEnabled: false });
    pwa.init();
    const ev = new Event('beforeinstallprompt');
    Object.assign(ev, {
      prompt: () => Promise.resolve(),
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });
    window.dispatchEvent(ev);
    expect(pwa.canInstall()).toBeTrue();
    expect(await pwa.promptInstall()).toBeTrue();
    expect(pwa.canInstall()).toBeFalse();
  });

  it('marks standalone after appinstalled', () => {
    const pwa = setup({ swEnabled: false });
    pwa.init();
    window.dispatchEvent(new Event('appinstalled'));
    expect(pwa.canInstall()).toBeFalse();
    expect(pwa.isStandalone()).toBeTrue();
  });

  it('swallows checkForUpdate failures', async () => {
    const pwa = setup();
    checkForUpdate.and.rejectWith(new Error('offline'));
    pwa.init();
    await Promise.resolve();
    expect(pwa.updateReady()).toBeFalse();
  });

  it('applyUpdate clears snooze and reloads', async () => {
    const pwa = setup();
    const reload = spyOn(pwa as unknown as { reloadFresh: () => Promise<void> }, 'reloadFresh').and.resolveTo();
    snoozeUpdate();
    pwa.applyUpdate();
    expect(isUpdateSnoozed()).toBeFalse();
    expect(reload).toHaveBeenCalled();
  });

  it('unrecoverable triggers a fresh reload', () => {
    const pwa = setup();
    const apply = spyOn(pwa, 'applyUpdate');
    pwa.init();
    unrecoverable.next({ reason: 'broken' });
    expect(apply).toHaveBeenCalled();
  });

  it('checks again when the tab becomes visible', () => {
    const pwa = setup();
    pwa.init();
    checkForUpdate.calls.reset();
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(checkForUpdate).toHaveBeenCalled();
  });
});
