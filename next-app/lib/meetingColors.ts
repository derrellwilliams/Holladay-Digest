export function cleanMeetingType(type: string): string {
  return type.replace(/\(opens in(to)? a? ?new window\)/gi, '').trim();
}

export function getCanonicalType(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('city council')) return 'City Council';
  if (t.includes('planning commission')) return 'Planning Commission';
  return cleanMeetingType(type);
}

export function getSubtype(type: string, full = false): string {
  const t = type.toLowerCase();
  if (t.includes('audio only')) return '';
  if (!full) return '';
  if (t.includes('rda')) return 'RDA';
  if (t.includes('work meeting') || t.includes('work mtg')) return 'Work Meeting';
  if (t.includes('legislative')) return 'Legislative';
  return '';
}

export function getTypeColor(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('city council')) return 'bg-ash text-granite';
  if (t.includes('planning commission')) return 'bg-dust text-gunmetal';
  return 'bg-dust text-gunmetal';
}
