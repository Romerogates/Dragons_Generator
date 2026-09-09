import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface GuideTopicStats {
  topicId: string;
  commentCount: number;
  lastCommentAt: string | null;
}

export interface GuideComment {
  id: string;
  topicId: string;
  userId: string;
  authorName: string;
  body: string;
  parentId: string | null;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
}

@Injectable({ providedIn: 'root' })
export class GuideCommentsService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  listStats(): Observable<GuideTopicStats[]> {
    return this.http.get<GuideTopicStats[]>(`${this.api}/guide/topics/stats`);
  }

  listComments(topicId: string): Observable<GuideComment[]> {
    return this.http.get<GuideComment[]>(`${this.api}/guide/topics/${encodeURIComponent(topicId)}/comments`);
  }

  createComment(topicId: string, body: string, parentId?: string | null): Observable<GuideComment> {
    return this.http.post<GuideComment>(`${this.api}/guide/topics/${encodeURIComponent(topicId)}/comments`, {
      body,
      parentId: parentId || null,
    });
  }

  deleteComment(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/guide/comments/${id}`);
  }

  toggleLike(id: string): Observable<GuideComment> {
    return this.http.post<GuideComment>(`${this.api}/guide/comments/${id}/like`, {});
  }
}
