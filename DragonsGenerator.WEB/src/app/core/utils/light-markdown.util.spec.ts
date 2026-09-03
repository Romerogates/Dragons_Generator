import { renderLightMarkdown } from './light-markdown.util';

describe('renderLightMarkdown', () => {
  it('renders headings, bold and lists', () => {
    const html = renderLightMarkdown('# Titre\n\n**gras**\n\n- item');
    expect(html).toContain('<h2');
    expect(html).toContain('<strong');
    expect(html).toContain('<li>');
    expect(html).toContain('item');
  });

  it('renders level 2 and 3 headings', () => {
    const html = renderLightMarkdown('## Sous-titre\n\n### Sous-sous-titre');
    expect(html).toContain('<h3');
    expect(html).toContain('Sous-titre');
    expect(html).toContain('<h4');
    expect(html).toContain('Sous-sous-titre');
  });

  it('embeds safe data:image PNG markdown images', () => {
    const src = 'data:image/png;base64,iVBORw0KGgo=';
    const html = renderLightMarkdown(`![Carte](${src})`);
    expect(html).toContain('<img');
    expect(html).toContain(src);
    expect(html).toContain('alt="Carte"');
  });

  it('ignores non data-image image urls', () => {
    const html = renderLightMarkdown('![x](https://evil.example/a.png)');
    expect(html).not.toContain('<img');
  });

  it('escapes HTML in text', () => {
    const html = renderLightMarkdown('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
