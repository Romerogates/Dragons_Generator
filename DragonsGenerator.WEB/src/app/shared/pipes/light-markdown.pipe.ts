import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { renderLightMarkdown } from '@core/utils/light-markdown.util';

@Pipe({ name: 'lightMarkdown', standalone: true, pure: true })
export class LightMarkdownPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    const html = renderLightMarkdown(value ?? '');
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
