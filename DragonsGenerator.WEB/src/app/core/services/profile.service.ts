import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { environment } from '@env/environment';
import { AuthService } from './auth.service';
import { OfflineProfileService } from './offline-profile.service';

export interface PublicUserProfile {
  id: string;
  displayName: string;
  bio: string | null;
  avatarEmoji: string | null;
  accentColor: string;
  memberSince: string;
  isSelf: boolean;
  isFriend: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly offline = inject(OfflineProfileService);
  private readonly api = environment.apiUrl;

  getPublicProfile(userId: string): Observable<PublicUserProfile> {
    if (!this.auth.isLoggedIn()) {
      throw new Error('Login required');
    }

    const cached = this.offline.readProfile<PublicUserProfile>(userId);
    const network$ = this.http.get<PublicUserProfile>(`${this.api}/users/${userId}/profile`).pipe(
      tap((profile) => this.offline.writeProfile(userId, profile)),
    );

    if (cached) {
      network$.subscribe({ error: () => undefined });
      return of(cached);
    }

    return network$;
  }
}
