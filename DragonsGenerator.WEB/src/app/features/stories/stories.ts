import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { StoryBuilderService } from '@core/services/story-builder.service';
import { RpgStory } from '@core/models/Story/story';

@Component({
  selector: 'app-stories',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './stories.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class Stories implements OnInit {
  private builder = inject(StoryBuilderService);
  private router = inject(Router);

  readonly stories = signal<RpgStory[]>([]);
  readonly storyToDelete = signal<RpgStory | null>(null);

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.stories.set(this.builder.loadSavedStories());
  }

  openStory(story: RpgStory): void {
    this.builder.loadStoryIntoBuilder(story);
    this.router.navigate(['/story/create']);
  }

  confirmDelete(story: RpgStory): void {
    this.storyToDelete.set(story);
  }

  cancelDelete(): void {
    this.storyToDelete.set(null);
  }

  deleteStory(): void {
    const story = this.storyToDelete();
    if (!story) return;
    this.builder.deleteSavedStory(story.id);
    this.storyToDelete.set(null);
    this.reload();
  }

  formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  }
}
