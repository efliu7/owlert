// Hover and pin tints can layer over the 9% header tint, reaching about 22%.
// Keep course text readable against white and that darkest combined tint.
export function courseTextColor(hex: string): string {
  if (!/^#[\da-f]{6}$/i.test(hex)) return '#4f2683';
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((value) => parseInt(value, 16));
  const luminance = (rgb: number[]) =>
    rgb.reduce((sum, channel, index) => {
      const value = channel / 255;
      const linear =
        value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      return sum + linear * [0.2126, 0.7152, 0.0722][index]!;
    }, 0);
  const background = luminance(
    channels.map((value) => value * 0.22 + 255 * 0.78),
  );
  let text = [...channels];
  while ((background + 0.05) / (luminance(text) + 0.05) < 4.5) {
    text = text.map((value) => Math.floor(value * 0.9));
  }
  return `#${text.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}
