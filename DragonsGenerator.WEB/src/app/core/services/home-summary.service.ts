import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '@env/environment';
import { AuthService } from './auth.service';

export interface HomeCampaignPreview {
  id: string;
  title: string;
  role: string;
  updatedAt: string;
}

export interface HomeSessionPreview {
  campaignId: string;
  campaignTitle: string;
  sessionTitle: string;
  scheduledAt: string;
}

export interface HomeSummary {
  savedCharactersCount: number;
  unreadChatCount: number;
  pendingFriendRequests: number;
  pendingCampaignInvites: number;
  campaignCount: number;
  recentCampaign: HomeCampaignPreview | null;
  nextSession: HomeSessionPreview | null;
}

@Injectable({ providedIn: 'root' })
export class HomeSummaryService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly api = environment.apiUrl;

  getSummary(): Observable<HomeSummary | null> {
    if (!this.auth.isLoggedIn()) return of(null);
    return this.http.get<HomeSummary>(`${this.api}/me/home-summary`);
  }
}
