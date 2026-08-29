import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FriendsService } from '@core/services/friends.service';
import { FriendChatDockService } from '@core/services/friend-chat-dock.service';

/** Deep link depuis les notifications : ouvre le dock puis retourne à l'accueil. */
@Component({
  selector: 'app-friend-chat',
  standalone: true,
  template: `<p class="text-center text-slate-500 py-20 text-sm">Ouverture du chat…</p>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FriendChatPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly friends = inject(FriendsService);
  private readonly dock = inject(FriendChatDockService);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('userId');
    if (!id) {
      this.router.navigate(['/friends'], { replaceUrl: true });
      return;
    }
    this.friends.listFriends().subscribe((list) => {
      const match = list.find((f) => f.id === id);
      this.dock.openThread(id, match?.displayName ?? 'Ami');
      this.router.navigate(['/'], { replaceUrl: true });
    });
  }
}
