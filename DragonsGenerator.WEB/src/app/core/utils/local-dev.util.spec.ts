import { isLocalDevHost, mailhogWebUrl } from './local-dev.util';

describe('local-dev.util', () => {
  it('detects localhost and LAN hosts', () => {
    expect(isLocalDevHost('localhost')).toBeTrue();
    expect(isLocalDevHost('127.0.0.1')).toBeTrue();
    expect(isLocalDevHost('192.168.1.42')).toBeTrue();
    expect(isLocalDevHost('10.0.0.8')).toBeTrue();
    expect(isLocalDevHost('devbox.local')).toBeTrue();
    expect(isLocalDevHost('')).toBeFalse();
    expect(isLocalDevHost('dragons-generator.top')).toBeFalse();
  });

  it('builds MailHog URL from host', () => {
    expect(mailhogWebUrl('192.168.1.42')).toBe('http://192.168.1.42:8025');
    expect(mailhogWebUrl('127.0.0.1')).toBe('http://localhost:8025');
    expect(mailhogWebUrl('10.0.0.8')).toBe('http://10.0.0.8:8025');
  });
});
