/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */


export function getContactInitials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
}

export function getAvatarColorClass(id: string): string {
  const colors = [
    'bg-sky-500/10 text-sky-500 border-sky-500/20',
    'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    'bg-amber-500/10 text-amber-500 border-amber-500/20',
    'bg-purple-500/10 text-purple-500 border-purple-500/20',
    'bg-rose-500/10 text-rose-500 border-rose-500/20',
  ];
  let sum = 0;
  for (let i = 0; i < id.length; i++) {
    sum += id.charCodeAt(i);
  }
  return colors[sum % colors.length];
}
