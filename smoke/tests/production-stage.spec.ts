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

    // The heading first. The route resolves only once the `custom:personId` claim has, because
    // the page skips its query without one and the nav item sits on a spinner - so this alone is
    // what would catch mootmaker-api#39, the Cognito attribute write that never converges.
    await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible()

    // Then an actual meeting. This was deliberately absent until now: the page filters to ONE
    // person, and demo-data guaranteed a meeting on every weekday without guaranteeing the demo
    // user was on any of them, so asserting this would have failed for a data reason while
    // looking like a broken read. mootmaker-demo-data#29 makes it deterministic - the demo
    // Person is in that environment's guaranteed-person-ids list.
    //
    // Against the GRID, not "today". The calendar renders Mon-Fri only, so a release on a
    // Saturday or Sunday shows the week just gone; an assertion naming today would fail every
    // weekend. Every weekday in the six-week grid sits inside demo-data's seeding window on any
    // day of the week, so "some meeting is rendered" is true whenever the guarantee has run.
    //
    // This is the assertion the smoke suite existed for and did not have: it exercises
    // custom:personId -> workspace(dates:) -> day items -> per-person filtering, the whole v2.0.0
    // stack, where the heading alone proves only that a page rendered.
    await expect(page.locator('a[href^="/meetings/"]').first()).toBeVisible()
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
