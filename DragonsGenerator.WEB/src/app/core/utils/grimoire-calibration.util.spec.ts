import { drawGrimoireCalibrationOverlay } from './grimoire-calibration.util';

describe('grimoire-calibration.util', () => {
  it('drawGrimoireCalibrationOverlay marks each anchor on pdf', () => {
    const calls: string[] = [];
    const pdf = {
      setDrawColor: () => undefined,
      setTextColor: () => undefined,
      setFontSize: () => undefined,
      setLineWidth: () => undefined,
      line: () => undefined,
      circle: (_x: number, _y: number, _r: number, mode: string) => calls.push(mode),
      text: () => undefined,
    };

    drawGrimoireCalibrationOverlay(pdf as never, [
      { id: 'a', label: 'Test', x: 100, y: 200, group: 'G' },
    ]);

    expect(calls).toContain('S');
  });
});
