import { drawSheetCalibrationPreview } from './sheet-calibration-pdf.util';

describe('sheet-calibration-pdf.util', () => {
  it('drawSheetCalibrationPreview writes sample texts', () => {
    const texts: string[] = [];
    const pdf = {
      setTextColor: () => undefined,
      setFontSize: () => undefined,
      text: (t: string) => texts.push(t),
    };
    drawSheetCalibrationPreview(pdf as never, [
      {
        id: 'x',
        label: 'X',
        group: 'G',
        x: 100,
        y: 200,
        sampleText: 'Hello',
        fontSize: 12,
      },
      {
        id: 'empty',
        label: 'E',
        group: 'G',
        x: 50,
        y: 50,
        sampleText: '   ',
        fontSize: 10,
      },
    ]);
    expect(texts).toEqual(['Hello']);
  });
});
