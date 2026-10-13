import { defaultProfile, people, initialMatchIds, initialMessages } from '../data.js';

export const STORAGE_KEY = 'matchnade.demo.v1';
const freshState = () => ({ profile: { ...defaultProfile }, matchIds: [...initialMatchIds], scheduled: { ana: 'Sexta-feira, às 10:30' }, messages: structuredClone(initialMessages) });

export function readDemoState(storage) {
  const initial = freshState();
  try {
    storage ??= globalThis.localStorage;
    const saved = JSON.parse(storage?.getItem(STORAGE_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return initial;
    const profile = { ...defaultProfile };
    for (const [key, value] of Object.entries(defaultProfile)) {
      const stored = saved.profile?.[key];
      if (Array.isArray(value)) {
        if (Array.isArray(stored) && stored.every(item => typeof item === 'string')) profile[key] = stored;
      } else if (typeof stored === typeof value) profile[key] = stored;
    }
    profile.balance = Math.min(100, Math.max(0, profile.balance));
    if (!['local', 'regional', 'continental'].includes(profile.region)) profile.region = defaultProfile.region;
    const matchIds = Array.isArray(saved.matchIds) ? [...new Set(saved.matchIds.filter(id => people.some(person => person.id === id)))] : initial.matchIds;
    const scheduled = saved.scheduled && typeof saved.scheduled === 'object' && !Array.isArray(saved.scheduled) ? Object.fromEntries(Object.entries(saved.scheduled).filter(([id, slot]) => people.some(person => person.id === id) && typeof slot === 'string')) : initial.scheduled;
    const messages = saved.messages && typeof saved.messages === 'object' && !Array.isArray(saved.messages) ? Object.fromEntries(Object.entries(saved.messages).filter(([id, list]) => people.some(person => person.id === id) && Array.isArray(list)).map(([id, list]) => [id, list.filter(message => message && typeof message.text === 'string' && typeof message.own === 'boolean' && typeof message.time === 'string')])) : initial.messages;
    return { profile, matchIds, scheduled, messages };
  } catch { return initial; }
}

export function writeDemoState(state, storage) {
  try { (storage ?? globalThis.localStorage)?.setItem(STORAGE_KEY, JSON.stringify(state)); return true; } catch { return false; }
}
