/**
 * jspdf importe dynamiquement canvg / html2canvas (SVG et HTML → canvas).
 * Nos exports n’utilisent que JPEG/PNG + texte : ces plugins CJS ne servent pas
 * et polluent le build (warnings CommonJS + ~360 kB de chunks).
 */
export default undefined;
