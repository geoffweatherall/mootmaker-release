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
    await expect(page.getByText('Sign out')).toBeVisible()
  })

  test('the calendar opens for the signed-in user', async ({ page }) => {
    await signIn(page)

    // exact: true - a meeting whose subject happens to contain "Calendar" would otherwise match
    // the nav link (a real trap this project has hit before).
    await page.getByRole('link', { name: 'Calendar', exact: true }).click()

    // The heading, not the meetings. This page is filtered to ONE person - it renders only
    // meetings the signed-in user organises or attends - and demo-data guarantees a meeting on
    // every weekday, not that the published demo user is on any of them. Asserting a meeting is
    // visible would therefore fail for a data reason while looking like a broken read, and would
    // trigger an automatic production rollback that cannot fix it (mootmaker#46).
    //
    // What this DOES prove is worth more than it looks: the route resolves only once the
    // `custom:personId` claim has resolved, because the page skips its query without one and the
    // nav item sits on a spinner. So this assertion is what would catch mootmaker-api#39 - the
    // Cognito attribute write that never converges - in production.
    await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible()
  })

  test('room availability reads back from the database and displays', async ({ page }) => {
    await signIn(page)

    // Room Availability, NOT Rooms/People: those are admin-only sections of /settings, so
    // asserting on them here would depend on the demo user's role rather than on whether reads
    // work. This page renders real room data for any signed-in user.
    await page.getByRole('link', { name: 'Room Availability' }).click()
    await expect(page.getByRole('heading', { name: 'Room Availability' })).toBeVisible()
  })
})

async function signIn(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/')
  await page.getByLabel('Email').fill(demoEmail)
  await page.getByLabel('Password').fill(demoPassword)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText('Sign out')).toBeVisible()
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required. Run this via ./smoke/run.sh production <environment>.`)
  }
  return value
}
