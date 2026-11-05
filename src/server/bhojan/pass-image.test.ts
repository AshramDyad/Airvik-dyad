// @vitest-environment node
import { expect, it } from 'vitest';
import { passImage } from './passes';
it('renders the actual WhatsApp pass as a portrait PNG', async () => {
  const image = await passImage('b0000000-0000-4000-8000-000000000001', 'A10001', 1, '206');
  const buffer = Buffer.from(await image.arrayBuffer());
  expect(buffer.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(buffer.readUInt32BE(16)).toBe(640);
  expect(buffer.readUInt32BE(20)).toBe(780);
});
