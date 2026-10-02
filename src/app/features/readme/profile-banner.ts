/** Pure SVG shared by browser previews and the public image endpoint. */
export function profileBannerSvg(
  name: string,
  headline: string,
  background: string,
  accent: string,
): string {
  const escape = (text: string, max: number) =>
    [...text]
      .slice(0, max)
      .map((char) => (char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? ' ' : char))
      .join('')
      .replace(
        /[&<>"']/g,
        (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!,
      );
  const color = (value: string, fallback: string) =>
    /^[a-f0-9]{6}$/i.test(value) ? value : fallback;
  const title = escape(name || 'Hello, world', 40);
  const subtitle = escape(headline || 'Learn. Build. Share.', 75);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="300" viewBox="0 0 1200 300" role="img" aria-labelledby="title desc">
<title id="title">${title}</title><desc id="desc">${subtitle}</desc>
<rect width="1200" height="300" rx="18" fill="#${color(background, '102f28')}"/>
<path d="M0 265 Q300 205 600 265 T1200 250 V300 H0Z" fill="#${color(accent, '77dfba')}" opacity=".15"/>
<path d="M1040 42l32 32-32 32m-60-64l-32 32 32 32" stroke="#${color(accent, '77dfba')}" stroke-width="6" fill="none" stroke-linecap="round"/>
<text x="64" y="75" fill="#${color(accent, '77dfba')}" font-family="monospace" font-size="16" letter-spacing="3">LEARN · BUILD · SHARE</text>
<text x="64" y="155" fill="#ffffff" font-family="Arial, sans-serif" font-size="${[...name].length > 28 ? 36 : 48}" font-weight="700">${title}</text>
<text x="64" y="205" fill="#${color(accent, '77dfba')}" font-family="Arial, sans-serif" font-size="21">${subtitle}</text>
</svg>`;
}
