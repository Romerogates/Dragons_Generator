import { adminRamPercent, formatAdminBytes, formatAdminCount, formatAdminDuration } from './admin-stats.format';

describe('admin-stats.format', () => {
  it('formats bytes in French units', () => {
    expect(formatAdminBytes(512)).toBe('512 o');
    expect(formatAdminBytes(2048)).toBe('2\u00a0Ko');
    expect(formatAdminBytes(5 * 1024 * 1024)).toBe('5\u00a0Mo');
    expect(formatAdminBytes(null)).toBe('—');
    expect(formatAdminBytes(-1)).toBe('—');
    expect(formatAdminBytes(Number.NaN)).toBe('—');
    expect(formatAdminBytes(3 * 1024 * 1024 * 1024)).toContain('Go');
    expect(formatAdminBytes(2 * 1024 * 1024 * 1024 * 1024)).toContain('To');
    expect(formatAdminBytes(1536)).toContain('Ko');
  });

  it('formats uptime', () => {
    expect(formatAdminDuration(12)).toBe('12 s');
    expect(formatAdminDuration(90)).toBe('1 min');
    expect(formatAdminDuration(3661)).toBe('1 h 1 min');
    expect(formatAdminDuration(90000)).toBe('1 j 1 h');
    expect(formatAdminDuration(null)).toBe('—');
    expect(formatAdminDuration(-3)).toBe('—');
    expect(formatAdminDuration(0)).toBe('0 s');
  });

  it('formats counts and RAM percent', () => {
    expect(formatAdminCount(12345).replace(/\s/g, '')).toBe('12345');
    expect(adminRamPercent(50, 100)).toBe(50);
    expect(adminRamPercent(120, 100)).toBe(100);
    expect(adminRamPercent(10, null)).toBeNull();
    expect(adminRamPercent(null, 10)).toBeNull();
    expect(adminRamPercent(10, 0)).toBeNull();
    expect(formatAdminCount(null)).toBe('—');
    expect(formatAdminCount(Number.NaN)).toBe('—');
  });
});
