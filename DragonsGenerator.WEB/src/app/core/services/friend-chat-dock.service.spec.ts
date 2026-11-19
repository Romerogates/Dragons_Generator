import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { AuthService } from './auth.service';
import { FriendChatDockService } from './friend-chat-dock.service';
import { FriendChatService } from './friend-chat.service';
import { FriendsService } from './friends.service';
import { AiGenerationProgressService } from './ai-generation-progress.service';

describe('FriendChatDockService history', () => {
  let service: FriendChatDockService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...zonelessTestProviders,
        FriendChatDockService,
        { provide: AuthService, useValue: { isLoggedIn: signal(true) } },
        {
          provide: FriendsService,
          useValue: { listFriends: () => of([]) },
        },
        {
          provide: FriendChatService,
          useValue: { listSummaries: () => of([]) },
        },
        {
          provide: AiGenerationProgressService,
          useValue: { active: () => false },
        },
      ],
    });
    service = TestBed.inject(FriendChatDockService);
    service.init();
  });

  afterEach(() => {
    service.close();
    service.destroy();
  });

  it('pushes a list hash when opening the dock', () => {
    const push = spyOn(history, 'pushState').and.callThrough();
    service.open();
    expect(service.isOpen()).toBeTrue();
    expect(service.view()).toBe('list');
    expect(push).toHaveBeenCalled();
    const url = String(push.calls.mostRecent().args[2]);
    expect(url).toContain('#dg-chat');
    expect(url).not.toContain('#dg-chat-thread');
  });

  it('pushes list then thread so hardware back can close the conversation first', () => {
    const push = spyOn(history, 'pushState').and.callThrough();
    service.openThread('u1', 'Lyra');
    expect(service.view()).toBe('thread');
    expect(push.calls.count()).toBe(2);
    expect(String(push.calls.argsFor(0)[2])).toContain('#dg-chat');
    expect(String(push.calls.argsFor(1)[2])).toContain('#dg-chat-thread');
  });

  it('returns to the inbox on popstate from a thread, then closes on the next popstate', () => {
    service.openThread('u1', 'Lyra');
    expect(service.view()).toBe('thread');

    window.dispatchEvent(new PopStateEvent('popstate', { state: { dgFriendChat: 'list' } }));
    expect(service.isOpen()).toBeTrue();
    expect(service.view()).toBe('list');
    expect(service.activeFriendId()).toBeNull();

    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(service.isOpen()).toBeFalse();
  });
});
