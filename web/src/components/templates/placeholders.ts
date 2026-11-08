export const placeholderGroups = [
  { title: 'Contato', tags: ['name'] },
  { title: 'Saudações e período', tags: ['greeting', 'greeting_lower', 'saudacao', 'saudacao_lower', 'period'] },
  { title: 'Datas e horários', tags: ['date', 'date_iso', 'time', 'weekday', 'day_name', 'month_name', 'year', 'day', 'month', 'hour', 'minute'] },
];
const _known = new Set(placeholderGroups.flatMap(group => group.tags));
export function unknownPlaceholders(body: string): string[] {
  return [...new Set(body.match(/\{\{[^}]+\}\}/g) ?? [])].filter(tag => !_known.has(tag.slice(2, -2)));
}
export function samplePreview(body: string, date = new Date()): string {
  const hour = date.getHours();
  const greeting = hour >= 5 && hour < 12 ? 'Bom dia' : hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite';
  const pad = (value: number): string => String(value).padStart(2, '0');
  const values: Record<string, string> = {
    name: 'Carlos Silva', greeting, greeting_lower: greeting.toLocaleLowerCase('pt-BR'), saudacao: greeting, saudacao_lower: greeting.toLocaleLowerCase('pt-BR'),
    period: hour >= 5 && hour < 12 ? 'manhã' : hour >= 12 && hour < 18 ? 'tarde' : 'noite',
    date: date.toLocaleDateString('pt-BR'), date_iso: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(hour)}:${pad(date.getMinutes())}`, weekday: date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
    day_name: date.toLocaleDateString('pt-BR', { weekday: 'long' }), month_name: date.toLocaleDateString('pt-BR', { month: 'long' }),
    year: String(date.getFullYear()), day: pad(date.getDate()), month: pad(date.getMonth() + 1), hour: pad(hour), minute: pad(date.getMinutes()),
  };
  return body.replace(/\{\{([^}]+)\}\}/g, (tag: string, key: string): string => values[key] ?? tag);
}
