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
    expect(href).toContain('category=ia');
    expect(href).toContain('campaignId=camp-1');
    expect(href).toContain('subject=');
    expect(decodeURIComponent(href)).toContain('Échec génération IA (adventure)');
  });
});
