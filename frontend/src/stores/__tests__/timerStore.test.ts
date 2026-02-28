import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useTimerStore } from '../timerStore';

describe('timerStore', () => {
  beforeEach(() => {
    useTimerStore.getState().reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with default idle state', () => {
    const state = useTimerStore.getState();
    expect(state.isRunning).toBe(false);
    expect(state.matterId).toBeNull();
    expect(state.description).toBe('');
    expect(state.startedAt).toBeNull();
    expect(state.elapsed).toBe(0);
  });

  it('start sets isRunning to true', () => {
    useTimerStore.getState().start('matter-001', 'Research task');

    const state = useTimerStore.getState();
    expect(state.isRunning).toBe(true);
  });

  it('start sets matterId and description', () => {
    useTimerStore.getState().start('matter-001', 'Research task');

    const state = useTimerStore.getState();
    expect(state.matterId).toBe('matter-001');
    expect(state.description).toBe('Research task');
  });

  it('start sets startedAt to current time', () => {
    const now = Date.now();
    useTimerStore.getState().start('matter-001', 'Research task');

    const state = useTimerStore.getState();
    expect(state.startedAt).toBe(now);
  });

  it('start resets elapsed to 0', () => {
    // Simulate some elapsed time
    useTimerStore.getState().start('matter-001', 'First task');
    vi.advanceTimersByTime(5000);
    useTimerStore.getState().tick();

    expect(useTimerStore.getState().elapsed).toBe(5);

    // Start new timer
    useTimerStore.getState().start('matter-002', 'Second task');
    expect(useTimerStore.getState().elapsed).toBe(0);
  });

  it('stop sets isRunning to false', () => {
    useTimerStore.getState().start('matter-001', 'Research task');
    expect(useTimerStore.getState().isRunning).toBe(true);

    useTimerStore.getState().stop();
    expect(useTimerStore.getState().isRunning).toBe(false);
  });

  it('stop returns matter data and elapsed time', () => {
    useTimerStore.getState().start('matter-001', 'Research task');

    vi.advanceTimersByTime(120_000); // 120 seconds

    const result = useTimerStore.getState().stop();

    expect(result.matterId).toBe('matter-001');
    expect(result.description).toBe('Research task');
    expect(result.elapsed).toBe(120);
  });

  it('tick increments elapsed based on startedAt', () => {
    useTimerStore.getState().start('matter-001', 'Research task');

    vi.advanceTimersByTime(10_000); // 10 seconds
    useTimerStore.getState().tick();

    expect(useTimerStore.getState().elapsed).toBe(10);
  });

  it('tick does nothing when timer is not running', () => {
    useTimerStore.getState().tick();

    expect(useTimerStore.getState().elapsed).toBe(0);
  });

  it('tick accumulates time correctly over multiple ticks', () => {
    useTimerStore.getState().start('matter-001', 'Research task');

    vi.advanceTimersByTime(5000);
    useTimerStore.getState().tick();
    expect(useTimerStore.getState().elapsed).toBe(5);

    vi.advanceTimersByTime(5000);
    useTimerStore.getState().tick();
    expect(useTimerStore.getState().elapsed).toBe(10);
  });

  it('reset clears all timer state', () => {
    useTimerStore.getState().start('matter-001', 'Research task');
    vi.advanceTimersByTime(30_000);
    useTimerStore.getState().tick();

    // Verify state is populated
    expect(useTimerStore.getState().isRunning).toBe(true);
    expect(useTimerStore.getState().elapsed).toBe(30);

    useTimerStore.getState().reset();

    const state = useTimerStore.getState();
    expect(state.isRunning).toBe(false);
    expect(state.matterId).toBeNull();
    expect(state.description).toBe('');
    expect(state.startedAt).toBeNull();
    expect(state.elapsed).toBe(0);
  });

  it('supports starting a new timer after stopping', () => {
    useTimerStore.getState().start('matter-001', 'First task');
    vi.advanceTimersByTime(60_000);
    useTimerStore.getState().stop();

    useTimerStore.getState().start('matter-002', 'Second task');

    const state = useTimerStore.getState();
    expect(state.isRunning).toBe(true);
    expect(state.matterId).toBe('matter-002');
    expect(state.description).toBe('Second task');
    expect(state.elapsed).toBe(0);
  });
});
