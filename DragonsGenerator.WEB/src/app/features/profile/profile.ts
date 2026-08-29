import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProfileService, PublicUserProfile } from '@core/services/profile.service';
import { AuthService } from '@core/services/auth.service';
import { FriendChatDockService } from '@core/services/friend-chat-dock.service';
import {
  accentGradient,
  profileInitial,
} from '@core/utils/profile.util';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './profile.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ProfilePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly profiles = inject(ProfileService);
  private readonly auth = inject(AuthService);
  private readonly chatDock = inject(FriendChatDockService);

  readonly profile = signal<PublicUserProfile | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const paramId = this.route.snapshot.paramMap.get('userId');
    const userId = paramId ?? this.auth.user()?.id;
    if (!userId) {
      this.loading.set(false);
      this.error.set('Connectez-vous pour voir votre profil.');
      return;
    }
    this.profiles.getPublicProfile(userId).subscribe({
      next: (p) => {
        this.profile.set(p);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Profil introuvable.');
        this.loading.set(false);
      },
    });
  }

  avatarGradient(p: PublicUserProfile): string {
    return accentGradient(p.accentColor);
  }

  initial(p: PublicUserProfile): string {
    return profileInitial(p.displayName);
  }

  openChat(p: PublicUserProfile): void {
    this.chatDock.openThread(p.id, p.displayName, p.avatarEmoji, p.accentColor);
  }
}
