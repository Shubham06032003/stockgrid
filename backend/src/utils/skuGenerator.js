export function generateSKU(name = '', category = '') {
  const namePart = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w.substring(0, 3))
    .join('');

  const catPart = category
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 3);

  const suffix = Math.floor(Math.random() * 900 + 100);

  return `${catPart || 'GEN'}-${namePart || 'PRD'}-${suffix}`;
}
