import { defineConfig, devices } from '@playwright/test'

/**
 * Smoke tests for the release pipeline. See ../mootmaker/designs/ci-cd-pipeline.md Decision 9.
 *
 * These are deliberately NOT a second acceptance suite. They are the five minutes of clicking a
 * human tester would actually do, and the two projects below are deliberately asymmetric:
 *
 *   test-stage        mutates data - signs up a real account, creates a meeting, resets a
 *                     password, deletes the account. That is the point: it closes the "does a
 *                     write actually work against a real deployment" gap.
 *   production-stage  strictly READ-ONLY, no exceptions. No signup, no deletion, no password
 *                     reset, and no meeting creation either. production takes no writes from this
 *                     stage at all, which is what stops the smoke tests accumulating stray data
 *                     release after release.
 *
 * Both run against an already-deployed environment; neither creates or tears one down.
 */
export default defineConfig({
  testDir: './tests',
  // A release is sequential and a failure should stop it, not produce a long parallel report.
  fullyParallel: false,
  workers: 1,
  // Decision 9's output config, deliberately at the low end. The JSON reporter's test names,
  // pass/fail, timing and error text are what make Decision 11's CloudWatch shipping readable at a
  // few KB per run. trace/video/screenshot are a different axis entirely and can balloon to
  // hundreds of MB - that heavier recording already exists in the acceptance suites, and a
  // five-minute smoke check is not another place to reproduce it.
  reporter: process.env.CI ? 'json' : 'list',
  use: {
    baseURL: requireEnv('WEBAPP_URL'),
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
  projects: [
    {
      name: 'test-stage',
      testMatch: /test-stage\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
    {
      name: 'production-stage',
      testMatch: /production-stage\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
})

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required. Run these via ./smoke/run.sh <environment>.`)
  }
  return value
}
