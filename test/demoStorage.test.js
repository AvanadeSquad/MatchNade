import test from 'node:test';
import assert from 'node:assert/strict';
import { readDemoState, writeDemoState, STORAGE_KEY } from '../src/utils/demoStorage.js';
import { defaultProfile } from '../src/data.js';

function storageWith(value) {
  const items = new Map([[STORAGE_KEY, value]]);
  return { getItem: key => items.get(key) || null, setItem: (key, next) => items.set(key, next) };
}

test('recovers the demo when local data is malformed or storage is inaccessible', () => {
  assert.deepEqual(readDemoState(storageWith('{bad json')).profile, defaultProfile);
  const denied = { getItem() { throw new Error('Access denied'); }, setItem() { throw new Error('Full'); } };
  assert.equal(readDemoState(denied).matchIds.length, 5);
  assert.equal(writeDemoState({}, denied), false);
});

test('loads valid preferences while rejecting corrupted types, contacts and message contents', () => {
  const state = readDemoState(storageWith(JSON.stringify({
    profile: { name: 'Joan', hobbies: ['Leitura'], skills: ['Cloud', 123], balance: 170, region: 'invalid', coffee: 'false' },
    matchIds: ['marina', 'missing', 'marina', 'ana'],
    scheduled: { marina: '14/10/2026, às 10:30', ana: 123, missing: '12:00' },
    messages: { marina: [{ id: '1', text: 'Olá!', own: true, time: '10:30' }, { text: 5, own: false }], missing: [] },
  })));
  assert.equal(state.profile.name, 'Joan');
  assert.deepEqual(state.profile.hobbies, ['Leitura']);
  assert.deepEqual(state.profile.skills, defaultProfile.skills);
  assert.equal(state.profile.balance, 100);
  assert.equal(state.profile.region, 'regional');
  assert.equal(state.profile.coffee, true);
  assert.deepEqual(state.matchIds, ['marina', 'ana']);
  assert.deepEqual(state.scheduled, { marina: '14/10/2026, às 10:30' });
  assert.equal(state.messages.marina.length, 1);
  assert.equal(state.messages.missing, undefined);
});

test('round trips edited profile, meetings and messages through local storage', () => {
  const storage = storageWith(null);
  const state = readDemoState(storage);
  state.profile.name = 'Joan';
  state.scheduled.camila = '15/10/2026, às 14:00';
  state.messages.camila = [{ id: '1', text: 'Vamos tomar um café?', own: true, time: '14:00' }];
  assert.equal(writeDemoState(state, storage), true);
  assert.deepEqual(readDemoState(storage), state);
});
