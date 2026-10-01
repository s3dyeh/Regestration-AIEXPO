import { badgeCatalog, frameworkLogoUrl } from './src/app/features/readme/profile-badges';
console.log(await Promise.all(badgeCatalog.map(async name => {
  try {
    const response = await fetch(frameworkLogoUrl(name), { signal: AbortSignal.timeout(15000) });
    const body = await response.text();
    return { name, status: response.status, svg: body.includes('<svg') };
  } catch { return { name, error: true }; }
})));
