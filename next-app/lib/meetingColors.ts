export function cleanMeetingType(type: string): string {
  return type.replace(/\(opens in(to)? a? ?new window\)/gi, '').trim();
}

export function getCanonicalType(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('city council')) return 'City Council';
  if (t.includes('planning commission')) return 'Planning Commission';
  return cleanMeetingType(type);
}

export function getSubtype(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('audio only')) return '';
  if (t.includes('work meeting') || t.includes('work mtg')) return 'Work Meeting';
  return '';
}

export function getTypeColor(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('city council')) return 'bg-blue-100 text-blue-800';
  if (t.includes('planning commission')) return 'bg-green-100 text-green-800';
  if (t.includes('board of adjustment')) return 'bg-purple-100 text-purple-800';
  if (t.includes('arts council')) return 'bg-pink-100 text-pink-800';
  if (t.includes('historic')) return 'bg-amber-100 text-amber-800';
  return 'bg-gray-100 text-gray-800';
}
