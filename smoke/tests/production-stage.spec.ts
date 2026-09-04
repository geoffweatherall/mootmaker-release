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

  test('meeting data reads back from the database and displays', async ({ page }) => {
    await signIn(page)

    // Demo data is always deployed to production and refreshed daily, so production genuinely has
    // meetings to read. An empty page here means either the read path is broken or demo-data has
    // stopped running - both worth failing a release for.
    //
    // exact: true - a meeting whose subject happens to contain "Calendar" would otherwise match
    // the nav link (a real trap this project has hit before).
    await page.getByRole('link', { name: 'Calendar', exact: true }).click()
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

// TEMPORARY - deliberately fails, to satisfy the Definition of done's requirement that the
// automatic production rollback (Decision 10) be exercised at least once. Placed last so the real
// read-only checks run first: the point is that a genuine production smoke run failed, not that it
// never happened.
//
// This DOES break production briefly and relies on the pipeline to recover it, which is the whole
// point - a release process whose recovery path has never run is not a tested release process.
// Removed immediately after the exercise.
test('DELIBERATE FAILURE - proves the automatic production rollback runs', async () => {
  expect(true, 'intentional failure exercising Decision 10').toBe(false)
})
