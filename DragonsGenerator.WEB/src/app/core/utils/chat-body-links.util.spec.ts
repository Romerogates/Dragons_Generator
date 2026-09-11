import { parseChatBodySegments, extractJoinTokenFromUrl } from './chat-body-links.util';

describe('chat-body-links.util', () => {
  it('extracts join token from invite URL', () => {
    expect(
      extractJoinTokenFromUrl('https://dragons-generator.top/join/O2tw0xksXdmCjMLKkQTo_-mQXcz0q0d-'),
    ).toBe('O2tw0xksXdmCjMLKkQTo_-mQXcz0q0d-');
  });

  it('linkifies plain URLs and join invites', () => {
    const segs = parseChatBodySegments(
      'voici https://dragons-generator.top/join/AbCdEfGh12345678 merci et https://example.com/x',
    );
    expect(segs.some((s) => s.type === 'join')).toBeTrue();
    expect(segs.some((s) => s.type === 'url' && s.href.includes('example.com'))).toBeTrue();
    expect(segs.some((s) => s.type === 'text' && s.value.includes('voici'))).toBeTrue();
  });
});
