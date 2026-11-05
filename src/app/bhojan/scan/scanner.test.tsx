import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Scanner from './scanner';

const camera = vi.hoisted(() => ({ scan: (_value: { data: string }) => { void _value; }, start: vi.fn().mockResolvedValue(undefined), destroy: vi.fn() }));
vi.mock('qr-scanner', () => ({ default: class {
  constructor(_video: HTMLVideoElement, scan: (value: { data: string }) => void) { camera.scan = scan; }
  start = camera.start;
  destroy = camera.destroy;
} }));
afterEach(() => { vi.restoreAllMocks(); });
describe('Bhojan scanner', () => {
  it('keeps camera mounted, suppresses repeated reads and waits for server validation', async () => {
    let resolve: (value: Response) => void = () => {};
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>(done => { resolve = done; }));
    const view = render(<Scanner />);
    await waitFor(() => expect(camera.start).toHaveBeenCalled());
    const video = screen.getByLabelText('Bhojan pass camera');
    act(() => {
      camera.scan({ data: 'bhojan:b0000000-0000-4000-8000-000000000001' });
      camera.scan({ data: 'bhojan:b0000000-0000-4000-8000-000000000001' });
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('Checking');
    await act(async () => resolve(Response.json({ valid: true, reason: 'Valid pass', passNumber: 1, room: '206' })));
    expect(screen.getByRole('status')).toHaveTextContent('Valid pass');
    expect(screen.getByLabelText('Bhojan pass camera')).toBe(video);
    view.unmount();
  });
  it('shows connection failure rather than rejecting the pass', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const view = render(<Scanner />);
    await waitFor(() => expect(camera.start).toHaveBeenCalled());
    await act(async () => camera.scan({ data: 'bhojan:b0000000-0000-4000-8000-000000000002' }));
    expect(screen.getByRole('status')).toHaveTextContent('No connection');
    expect(screen.getByRole('status')).not.toHaveTextContent('Invalid');
    view.unmount();
  });
});
