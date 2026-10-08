import { supportReportHref } from './support-report.util';

describe('supportReportHref', () => {
  it('builds a prefilled support URL', () => {
    const href = supportReportHref({
      subject: 'Échec génération IA (adventure)',
      message: '502',
      category: 'ia',
      campaignId: 'camp-1',
    });
    expect(href.startsWith('/support?')).toBeTrue();
    const q = new URLSearchParams(href.split('?')[1]);
    expect(q.get('category')).toBe('ia');
    expect(q.get('campaignId')).toBe('camp-1');
    expect(q.get('subject')).toBe('Échec génération IA (adventure)');
    expect(q.get('message')).toBe('502');
  });
});
