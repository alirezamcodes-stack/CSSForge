import { test, expect } from '@playwright/test';
import { classifyWatchdog, launchEditingPerformance, measureWorkload, measureOwnershipCycles, workloads, type Profile } from './edit-time-performanceHarness';

// Identical trusted pointer schedules run against the chosen unpacked build.
// Timing is recorded without an arbitrary pre-comparison performance ceiling.
for (const profile of ['simple', 'heavy'] as Profile[]) for (const workload of workloads) {
  test(`Design edit performance ${profile}: ${workload.id} sustained trusted gesture`, async ({}, info) => {
    test.setTimeout(90000);
    test.skip(!!process.env.CSSFORGE_EDIT_PERF_PROFILE && process.env.CSSFORGE_EDIT_PERF_PROFILE !== profile, 'Profile selected for comparable build run');
    test.skip(!!process.env.CSSFORGE_EDIT_PERF_CASES && !process.env.CSSFORGE_EDIT_PERF_CASES.split(',').includes(workload.id), 'Workload selected for focused diagnosis');
    const runtime = await launchEditingPerformance(info, profile);
    try { await measureWorkload(runtime, info, workload); }
    finally { await runtime.context.close(); }
  });
}

test('Design edit performance heavy: repeated ownership cycles release listeners and observers', async ({}, info) => {
  test.setTimeout(180000);
  test.skip(process.env.CSSFORGE_EDIT_PERF_PROFILE === 'simple', 'Ownership stress uses the heavy fixture');
  test.skip(!!process.env.CSSFORGE_EDIT_PERF_CASES && !process.env.CSSFORGE_EDIT_PERF_CASES.split(',').includes('cycles'), 'Workload selected for focused diagnosis');
  const runtime = await launchEditingPerformance(info, 'heavy');
  try { await measureOwnershipCycles(runtime, info); }
  finally { await runtime.context.close(); }
});

test('Design edit performance watchdog distinguishes timer starvation from corroborated stalls', () => {
  const before = { heartbeats: [25, 359.2], longTasks: [{ duration: 67 }], inputs: [{ type: 'pointermove', time: 0, queueDelay: 32 }, { type: 'pointermove', time: 66.7, queueDelay: 20 }] };
  expect(classifyWatchdog(before).confirmedStall).toBe(false);
  expect(classifyWatchdog({ ...before, heartbeats: [1500] }).confirmedStall).toBe(false);
  expect(classifyWatchdog({ ...before, heartbeats: [1500], longTasks: [{ duration: 1200 }] }).confirmedStall).toBe(true);
  expect(classifyWatchdog({ ...before, heartbeats: [1500], inputs: [...before.inputs, { type: 'pointermove', time: 1600, queueDelay: 1500 }] }).confirmedStall).toBe(true);
  expect(classifyWatchdog(undefined, true)).toMatchObject({ confirmedStall: true, dataAvailable: false, acknowledgementTimeout: true });
});
