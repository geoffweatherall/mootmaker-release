import { expect, test } from '@playwright/test'

/**
 * The production-stage smoke test. See ../../../mootmaker/designs/ci-cd-pipeline.md Decision 9.
 *
 * STRICTLY READ-ONLY, NO EXCEPTIONS. Signs in as the published demo user, navigates, and confirms
 * data reads back and displays. Deliberately absent, and none of these may be added later without
 * changing the design first:
 *
 *   - no account signup
 *   - no account deletion
 *   - no password reset
 *   - no meeting creation  <- the design's own first draft got this wrong and was corrected
 *
 * The reason is not squeamishness about production. It is that a read-only suite can never be the
 * thing that leaves stray data behind release after release, so there is no accumulation problem to
 * solve here the way there was for logs. Every write this layer performs happens in the test stage
 * (test-stage.spec.ts), which is what actually closes the "does a write work" gap.
 *
 * If a future change needs production to prove a write, that is a design change, not a test change.
 */

const demoEmail = requireEnv('DEMO_USER_EMAIL')
const demoPassword = requireEnv('DEMO_USER_PASSWORD')

test.describe('production smoke (read-only)', () => {
  test('the published demo user can sign in and read their data', async ({ page }) => {
    await page.goto('/')

    // The home page shows the demo credentials to every signed-out visitor - this is a public demo
    // by design (see mootmaker-webapp's README), so signing in as them is not a privileged act.
    await page.getByLabel('Email').fill(demoEmail)
    await page.getByLabel('Password').fill(demoPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()

    // Signed in is the first real assertion: it proves Cognito, the webapp bundle and its runtime
    // env-config.js all agree about which pool this environment uses - the exact thing that breaks
    // when a build is promoted with the wrong configuration.
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  })

  test('meeting data reads back from the database and displays', async ({ page }) => {
    await signIn(page)

    // Demo data is always deployed to production and refreshed daily, so production genuinely has
    // meetings to read. An empty list here means either the read path is broken or demo-data has
    // stopped running - both worth failing a release for.
    await page.getByRole('link', { name: 'Calendar', exact: true }).click()

    // exact: true throughout - a meeting whose subject happens to contain "Calendar" would
    // otherwise match the nav link (a real trap this project has hit before).
    await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible()
  })

  test('rooms and people read back from the database and display', async ({ page }) => {
    await signIn(page)

    await page.getByRole('link', { name: 'Rooms', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Rooms' })).toBeVisible()

    await page.getByRole('link', { name: 'People', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'People' })).toBeVisible()
  })
})

async function signIn(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/')
  await page.getByLabel('Email').fill(demoEmail)
  await page.getByLabel('Password').fill(demoPassword)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required. Run this via ./smoke/run.sh production <environment>.`)
  }
  return value
}
