import { expect, test } from '@playwright/test'
// Imported from the mootmaker-webapp sibling checkout rather than copied. This is the project's
// established convention for cross-repo reuse (mootmaker-webapp's own run.sh resolves
// ../mootmaker-api, demo-data's verify/ does the same), and duplicating it would be worse than the
// coupling: email.ts carries hard-won detail about standard-queue ordering and leaving other
// tests' messages untouched, so a divergent copy would show up as smoke tests reading each other's
// verification codes. See mootmaker-release#5 for the extraction question.
import { waitForVerificationCode } from '../../../mootmaker-webapp/support/email'
import { freshTestAccount } from '../../../mootmaker-webapp/support/testAccount'

/**
 * The test-stage smoke test. See ../../../mootmaker/designs/ci-cd-pipeline.md Decision 9.
 *
 * Roughly the five minutes of clicking a human tester would actually do against a fresh
 * deployment: sign up for real, sign in, create a meeting, look at existing demo data, reset the
 * password, delete the account again. Explicitly NOT a re-run of the acceptance suite - if this
 * grows into one, it has stopped being a smoke test.
 *
 * This suite MUTATES data, and that is the point: it is what closes the "does a write actually
 * work against a real deployment" gap that unit and mocked-integration layers cannot. It never
 * runs against production - run.sh refuses that combination outright, and the production suite is
 * strictly read-only (production-stage.spec.ts).
 *
 * Ordered, single-worker, and deliberately stateful across steps: the account created in the first
 * test is the one the later ones use and the last one deletes. Playwright's config sets workers: 1
 * and fullyParallel: false for exactly this reason.
 */

const account = freshTestAccount()

test.describe.configure({ mode: 'serial' })

test.describe('test-stage smoke', () => {
  test('a real signup receives a real emailed code and confirms', async ({ page }) => {
    await page.goto('/signup')

    await page.getByLabel('Name').fill(account.name)
    await page.getByLabel('Email').fill(account.email)
    await page.getByLabel('Password').fill(account.password)
    await page.getByRole('button', { name: 'Sign up' }).click()

    await expect(page.getByLabel('Verification code')).toBeVisible()

    // A real code, through the real SES -> SNS -> SQS pipeline. This is the single most valuable
    // assertion in the suite: it proves Cognito is wired to a verified SES identity in this
    // environment, which nothing cheaper can establish.
    const code = await waitForVerificationCode(account.email)
    await page.getByLabel('Verification code').fill(code)
    await page.getByRole('button', { name: 'Confirm' }).click()

    await expect(page.getByText('Sign out')).toBeVisible()
  })

  test('the new account can sign in', async ({ page }) => {
    await signIn(page, account.email, account.password)
  })

  test('existing demo data reads back and displays', async ({ page }) => {
    await signIn(page, account.email, account.password)

    // The test environment is seeded by demo-data, so there is real data to read. This is the read
    // half of the check - the write half is the meeting created below.
    //
    // Room Availability and Calendar, NOT Rooms/People: those are admin-only sections of
    // /settings, and the account this suite just signed up is a standard user. Asserting on them
    // would fail for an authorization reason while looking like a broken read.
    await page.getByRole('link', { name: 'Room Availability' }).click()
    await expect(page.getByRole('heading', { name: 'Room Availability' })).toBeVisible()

    await page.getByRole('link', { name: 'Calendar', exact: true }).click()
  })

  test('a meeting can be created', async ({ page }) => {
    await signIn(page, account.email, account.password)

    // A link, not a button, and there is more than one entry point to the form - hence .first().
    await page.getByRole('link', { name: 'Add Meeting' }).first().click()
    await expect(page.getByRole('heading', { name: 'Add Meeting' })).toBeVisible()

    const subject = `Smoke test ${Date.now()}`
    await page.getByLabel('Subject').fill(subject)

    // Pin the meeting to a fixed mid-morning slot rather than accepting the form's default, which
    // is roughly "now" in the BROWSER's timezone. Room Availability renders only business hours
    // (08:00-17:00), so a default-timed meeting is invisible there whenever the run happens
    // outside that window - which is every CI run, since runners are UTC while this project's
    // developer machine is UTC+12. The meeting was always created correctly; it simply was not
    // displayed, and the read-back below failed for a timezone reason that looked like a failed
    // write.
    //
    // Set before suggesting a room, so the suggestion is made against the slot actually being
    // booked rather than the default one.
    const startTime = page.getByRole('group', { name: 'Start time' })
    await startTime.getByRole('spinbutton', { name: 'Hours' }).fill('10')
    await startTime.getByRole('spinbutton', { name: 'Minutes' }).fill('00')

    const endTime = page.getByRole('group', { name: 'End time' })
    await endTime.getByRole('spinbutton', { name: 'Hours' }).fill('11')
    await endTime.getByRole('spinbutton', { name: 'Minutes' }).fill('00')

    // Suggest a room rather than picking one by name - the available rooms depend on whatever
    // demo-data generated, so asserting on a specific room name would make this suite depend on
    // demo data's content rather than on the app working.
    await page.getByRole('button', { name: 'Suggest a room' }).click()

    // Wait for the suggestion to actually land before saving. Clicking Save immediately races it:
    // the form validates with Room still empty, shows "Please select a room.", and the suggestion
    // then fills the field a moment later - so the page ends up looking correct while the save
    // never happened.
    await expect(page.getByRole('combobox', { name: 'Room' })).not.toHaveValue('')

    await page.getByRole('button', { name: 'Save' }).click()

    // Read the write back. A save that appears to succeed but does not persist is exactly the
    // failure this layer exists to catch.
    await expect(page.getByText(subject)).toBeVisible()
  })

  test('the password can be reset with a real emailed code', async ({ page }) => {
    await page.goto('/forgot-password')

    await page.getByLabel('Email').fill(account.email)
    await page.getByRole('button', { name: 'Send code' }).click()

    await expect(page.getByLabel('Verification code')).toBeVisible()

    const code = await waitForVerificationCode(account.email)
    const newPassword = `${account.password}-reset`

    await page.getByLabel('Verification code').fill(code)
    await page.getByLabel('New password').fill(newPassword)
    await page.getByRole('button', { name: 'Reset password' }).click()

    await expect(page.getByText('Sign out')).toBeVisible()

    // Keep the module-level account in step, so the deletion test below can still sign in.
    account.password = newPassword
  })

  test('the account can delete itself', async ({ page }) => {
    await signIn(page, account.email, account.password)

    await page.goto('/settings')

    // "Delete account" is the section HEADING, not a control. The button that opens the dialog and
    // the button that confirms inside it share the name "Delete my account", so the second is
    // scoped to the dialog rather than disambiguated by position.
    await page.getByRole('button', { name: 'Delete my account' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete my account' }).click()

    // Signed out is the observable outcome of a successful deletion. Asserted as the ABSENCE of
    // "Sign out" rather than the presence of a sign-in control, which differs between the nav link
    // and the home page's own form - absence is unambiguous either way.
    //
    // Cleaning up after itself is not incidental tidiness: it is what stops the test environment
    // accumulating a dead account per release, which would eventually make People meaningless.
    await expect(page.getByText('Sign out')).toHaveCount(0)
  })
})

async function signIn(page: import('@playwright/test').Page, email: string, password: string): Promise<void> {
  await page.goto('/')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText('Sign out')).toBeVisible()
}
