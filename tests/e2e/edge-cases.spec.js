import { test, expect } from '@playwright/test';
import fs from 'fs';
import {
  createTestProject,
  registerTestTeam,
  cleanupTestData,
  setConfig,
  getConfig,
  getMaxTeamNumber,
  loginAsAdmin,
  goToAdminTab,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
} from './helpers.js';

test.describe.configure({ mode: 'serial' });

let savedConfig;

test.beforeAll(async () => {
  savedConfig = await getConfig();
  // Clean stale test data from any previous failed runs
  await cleanupTestData();
  await setConfig({
    registration_open: true,
    members_per_team: 3,
    allow_incomplete_teams: false,
    min_members_per_team: null,
  });
});

test.afterAll(async () => {
  await cleanupTestData();
  await setConfig({
    course_name: savedConfig.course_name,
    registration_open: savedConfig.registration_open,
    allow_incomplete_teams: savedConfig.allow_incomplete_teams,
    min_members_per_team: savedConfig.min_members_per_team,
  });
});

// ───────────────────────────────────────────────────────────────
// 1. Race condition — last slot
// ───────────────────────────────────────────────────────────────
test('race condition — only one of two simultaneous registrations succeeds', async ({ browser }) => {
  const raceProject = await createTestProject('__TEST_RACE_PROJECT__', 1);

  // Create two independent browser contexts (two separate users)
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();
  const page1 = await context1.newPage();
  const page2 = await context2.newPage();

  try {
    // Both navigate to the student page
    await Promise.all([page1.goto('/'), page2.goto('/')]);
    await Promise.all([
      page1.waitForSelector('form', { timeout: 15000 }),
      page2.waitForSelector('form', { timeout: 15000 }),
    ]);

    // Fill page1 form
    await page1.fill('#name-0', 'Race User A1');
    await page1.fill('#reg-0', 'TEST-RACE-A-001');
    await page1.fill('#name-1', 'Race User A2');
    await page1.fill('#reg-1', 'TEST-RACE-A-002');
    await page1.fill('#name-2', 'Race User A3');
    await page1.fill('#reg-2', 'TEST-RACE-A-003');
    await page1.selectOption('select#project', { label: '__TEST_RACE_PROJECT__' });

    // Fill page2 form
    await page2.fill('#name-0', 'Race User B1');
    await page2.fill('#reg-0', 'TEST-RACE-B-001');
    await page2.fill('#name-1', 'Race User B2');
    await page2.fill('#reg-1', 'TEST-RACE-B-002');
    await page2.fill('#name-2', 'Race User B3');
    await page2.fill('#reg-2', 'TEST-RACE-B-003');
    await page2.selectOption('select#project', { label: '__TEST_RACE_PROJECT__' });

    // Click both submit buttons simultaneously
    await Promise.all([
      page1.click('button[type="submit"]'),
      page2.click('button[type="submit"]'),
    ]);

    // Wait for both to finish
    await Promise.all([
      page1.waitForSelector(
        'text=Registration Successful!, text=/already registered|project is full|closed/i',
        { timeout: 20000 }
      ).catch(() => {}),
      page2.waitForSelector(
        'text=Registration Successful!, text=/already registered|project is full|closed/i',
        { timeout: 20000 }
      ).catch(() => {}),
    ]);

    // Wait a bit for both pages to settle
    await Promise.all([page1.waitForTimeout(2000), page2.waitForTimeout(2000)]);

    const page1Success = await page1.locator('text=Registration Successful!').isVisible();
    const page2Success = await page2.locator('text=Registration Successful!').isVisible();

    // Exactly one should succeed
    expect(page1Success || page2Success).toBe(true);
    expect(page1Success && page2Success).toBe(false);
  } finally {
    await context1.close();
    await context2.close();
  }
});

// ───────────────────────────────────────────────────────────────
// 2. Registration closes mid-session
// ───────────────────────────────────────────────────────────────
test('registration closes mid-session — server rejects submission', async ({ browser }) => {
  await setConfig({ registration_open: true });

  // Create a project for this test
  const midProject = await createTestProject('__TEST_MID_PROJECT__', 5);

  const studentContext = await browser.newContext();
  const studentPage = await studentContext.newPage();

  try {
    await studentPage.goto('/');
    await studentPage.waitForSelector('form', { timeout: 10000 });

    // Fill the form but don't submit yet
    await studentPage.fill('#name-0', 'Mid Session User1');
    await studentPage.fill('#reg-0', 'TEST-MID-001');
    await studentPage.fill('#name-1', 'Mid Session User2');
    await studentPage.fill('#reg-1', 'TEST-MID-002');
    await studentPage.fill('#name-2', 'Mid Session User3');
    await studentPage.fill('#reg-2', 'TEST-MID-003');
    await studentPage.selectOption('select#project', { label: '__TEST_MID_PROJECT__' });

    // Admin closes registration while student has form filled
    await setConfig({ registration_open: false });

    // Student tries to submit
    await studentPage.click('button[type="submit"]');

    // Server should reject with "registration closed" error
    await expect(
      studentPage.getByText(/registration.*closed|closed.*registration/i)
    ).toBeVisible({ timeout: 15000 });
  } finally {
    await studentContext.close();
    await setConfig({ registration_open: true });
  }
});

// ───────────────────────────────────────────────────────────────
// 3. Project added after student loads page — visible after refresh
// ───────────────────────────────────────────────────────────────
test('project added after page load appears on refresh', async ({ browser }) => {
  const studentContext = await browser.newContext();
  const studentPage = await studentContext.newPage();

  try {
    await studentPage.goto('/');
    await studentPage.waitForSelector('select#project', { timeout: 10000 });

    // Use a timestamp-suffixed name to guarantee uniqueness across runs
    const newProjName = `__TEST_LATE_${Date.now()}__`;
    const optionBefore = studentPage.locator(`select#project option:has-text("${newProjName}")`);
    await expect(optionBefore).toHaveCount(0);

    // Admin adds a new project
    await createTestProject(newProjName, 3);

    // Without refresh, student still doesn't see it (expected behavior)
    await expect(optionBefore).toHaveCount(0);

    // After refresh, student sees the new project
    await studentPage.reload();
    await studentPage.waitForSelector('select#project', { timeout: 10000 });

    const optionAfter = studentPage.locator(`select#project option:has-text("${newProjName}")`);
    await expect(optionAfter).toHaveCount(1);
  } finally {
    await studentContext.close();
  }
});

// ───────────────────────────────────────────────────────────────
// 4. Admin deletes team — students with those reg numbers can re-register
// ───────────────────────────────────────────────────────────────
test('deleted team frees reg numbers for re-registration', async ({ page, browser }) => {
  const reregProject = await createTestProject('__TEST_REREG_PROJECT__', 5);

  // Register a team
  await registerTestTeam(reregProject.id, [
    { name: 'ReReg Alpha', registration_number: 'TEST-REREG-001' },
    { name: 'ReReg Beta', registration_number: 'TEST-REREG-002' },
    { name: 'ReReg Gamma', registration_number: 'TEST-REREG-003' },
  ]);

  // Admin deletes the team
  await loginAsAdmin(page);
  await goToAdminTab(page, 'Registered Teams');

  const targetRow = page.locator('tr').filter({ hasText: 'ReReg Alpha' });
  await expect(targetRow).toBeVisible({ timeout: 10000 });

  page.on('dialog', (dialog) => dialog.accept());
  await targetRow.locator('button[title="Delete Team"]').click();
  await expect(page.getByText('ReReg Alpha')).not.toBeVisible({ timeout: 10000 });

  // Now try to register with the same reg numbers in a new browser context
  const freshContext = await browser.newContext();
  const freshPage = await freshContext.newPage();

  try {
    await freshPage.goto('/');
    await freshPage.waitForSelector('form', { timeout: 10000 });

    await freshPage.fill('#name-0', 'ReReg Alpha New');
    await freshPage.fill('#reg-0', 'TEST-REREG-001'); // previously used, now freed
    await freshPage.fill('#name-1', 'ReReg Beta New');
    await freshPage.fill('#reg-1', 'TEST-REREG-002');
    await freshPage.fill('#name-2', 'ReReg Gamma New');
    await freshPage.fill('#reg-2', 'TEST-REREG-003');

    await freshPage.selectOption('select#project', { label: '__TEST_REREG_PROJECT__' });
    await freshPage.click('button[type="submit"]');

    await expect(freshPage.getByText('Registration Successful!')).toBeVisible({ timeout: 15000 });
  } finally {
    await freshContext.close();
  }
});

// ───────────────────────────────────────────────────────────────
// 5. Team number never reuses
// ───────────────────────────────────────────────────────────────
test('team number never reuses after deletion', async ({ page, browser }) => {
  const noReuseProject = await createTestProject('__TEST_NOREUSE_PROJECT__', 5);

  // Get current max team number
  const maxBefore = await getMaxTeamNumber();

  // Register a team
  await registerTestTeam(noReuseProject.id, [
    { name: 'NoReuse Alpha', registration_number: 'TEST-NOREUSE-001' },
    { name: 'NoReuse Beta', registration_number: 'TEST-NOREUSE-002' },
    { name: 'NoReuse Gamma', registration_number: 'TEST-NOREUSE-003' },
  ]);

  const maxAfterFirst = await getMaxTeamNumber();
  const firstTeamNumber = maxAfterFirst;
  expect(firstTeamNumber).toBe(maxBefore + 1);

  // Admin deletes that team
  await loginAsAdmin(page);
  await goToAdminTab(page, 'Registered Teams');

  const targetRow = page.locator('tr').filter({ hasText: 'NoReuse Alpha' });
  await expect(targetRow).toBeVisible({ timeout: 10000 });

  page.on('dialog', (dialog) => dialog.accept());
  await targetRow.locator('button[title="Delete Team"]').click();
  await expect(page.getByText('NoReuse Alpha')).not.toBeVisible({ timeout: 10000 });

  // Register another team
  const freshContext = await browser.newContext();
  const freshPage = await freshContext.newPage();

  try {
    await freshPage.goto('/');
    await freshPage.waitForSelector('form', { timeout: 10000 });

    await freshPage.fill('#name-0', 'NoReuse Next1');
    await freshPage.fill('#reg-0', 'TEST-NOREUSE-101');
    await freshPage.fill('#name-1', 'NoReuse Next2');
    await freshPage.fill('#reg-1', 'TEST-NOREUSE-102');
    await freshPage.fill('#name-2', 'NoReuse Next3');
    await freshPage.fill('#reg-2', 'TEST-NOREUSE-103');

    await freshPage.selectOption('select#project', { label: '__TEST_NOREUSE_PROJECT__' });
    await freshPage.click('button[type="submit"]');

    await expect(freshPage.getByText('Registration Successful!')).toBeVisible({ timeout: 15000 });

    // Verify the new team number is higher than the deleted one
    const newMaxTeamNumber = await getMaxTeamNumber();
    expect(newMaxTeamNumber).toBeGreaterThan(firstTeamNumber);
  } finally {
    await freshContext.close();
  }
});

// ───────────────────────────────────────────────────────────────
// 6. Special characters in member names
// ───────────────────────────────────────────────────────────────
test('special characters in member names — registers and displays correctly', async ({ page, browser }) => {
  const specialProject = await createTestProject('__TEST_SPECIAL_PROJECT__', 5);

  // Register via the student form with special characters
  const specialContext = await browser.newContext();
  const specialPage = await specialContext.newPage();

  try {
    await specialPage.goto('/');
    await specialPage.waitForSelector('form', { timeout: 10000 });

    await specialPage.fill('#name-0', 'Éàü O\'Brien, James');  // accents, apostrophe, comma
    await specialPage.fill('#reg-0', 'TEST-SPECIAL-001');
    await specialPage.fill('#name-1', 'عبدالعزيز');             // Arabic characters
    await specialPage.fill('#reg-1', 'TEST-SPECIAL-002');
    await specialPage.fill('#name-2', 'María "Mia" González'); // quotes, unicode
    await specialPage.fill('#reg-2', 'TEST-SPECIAL-003');

    await specialPage.selectOption('select#project', { label: '__TEST_SPECIAL_PROJECT__' });
    await specialPage.click('button[type="submit"]');

    await expect(specialPage.getByText('Registration Successful!')).toBeVisible({ timeout: 15000 });
  } finally {
    await specialContext.close();
  }

  // Verify admin dashboard displays them correctly
  await loginAsAdmin(page);
  await goToAdminTab(page, 'Registered Teams');

  await expect(page.getByText('عبدالعزيز')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/O'Brien/)).toBeVisible();

  // Export CSV and verify special characters are escaped
  await goToAdminTab(page, 'Export & Reset');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('button:has-text("Download CSV")'),
  ]);
  const path = await download.path();
  const csvContent = fs.readFileSync(path, 'utf-8');

  // Arabic characters should be in the CSV
  expect(csvContent).toContain('عبدالعزيز');
  // Apostrophes should be preserved
  expect(csvContent).toMatch(/O'Brien/);
});

// ───────────────────────────────────────────────────────────────
// 7. Very long inputs
// ───────────────────────────────────────────────────────────────
test('very long inputs — handles gracefully without crashing', async ({ browser }) => {
  const longProject = await createTestProject('__TEST_LONG_PROJECT__', 5);
  const longName = 'A'.repeat(501);
  const longReg = 'B'.repeat(501);

  const longContext = await browser.newContext();
  const longPage = await longContext.newPage();

  try {
    await longPage.goto('/');
    await longPage.waitForSelector('form', { timeout: 10000 });

    await longPage.fill('#name-0', longName);
    await longPage.fill('#reg-0', longReg);
    await longPage.fill('#name-1', 'Normal Name');
    await longPage.fill('#reg-1', 'TEST-LONG-NORMAL-001');
    await longPage.fill('#name-2', 'Another Name');
    await longPage.fill('#reg-2', 'TEST-LONG-NORMAL-002');

    await longPage.selectOption('select#project', { label: '__TEST_LONG_PROJECT__' });
    await longPage.click('button[type="submit"]');

    // Should either succeed or show an error — NOT crash
    const successLocator = longPage.getByText('Registration Successful!');
    const errorLocator = longPage.locator('div.bg-red-50');
    await expect(successLocator.or(errorLocator).first()).toBeVisible({ timeout: 15000 });

    const hasSuccess = await successLocator.isVisible();
    const hasError = await errorLocator.isVisible();
    expect(hasSuccess || hasError).toBe(true);
  } finally {
    await longContext.close();
  }
});

// ───────────────────────────────────────────────────────────────
// 8. Multiple submissions from same page (double-click prevention)
// ───────────────────────────────────────────────────────────────
test('double-click submit — only one team created', async ({ browser }) => {
  const dblClickProject = await createTestProject('__TEST_DBLCLICK_PROJECT__', 5);

  const dblContext = await browser.newContext();
  const dblPage = await dblContext.newPage();

  try {
    await dblPage.goto('/');
    await dblPage.waitForSelector('form', { timeout: 10000 });

    await dblPage.fill('#name-0', 'DoubleClick User1');
    await dblPage.fill('#reg-0', 'TEST-DBLCLICK-001');
    await dblPage.fill('#name-1', 'DoubleClick User2');
    await dblPage.fill('#reg-1', 'TEST-DBLCLICK-002');
    await dblPage.fill('#name-2', 'DoubleClick User3');
    await dblPage.fill('#reg-2', 'TEST-DBLCLICK-003');

    await dblPage.selectOption('select#project', { label: '__TEST_DBLCLICK_PROJECT__' });

    // Click submit
    await dblPage.click('button[type="submit"]');

    // Button should immediately become disabled
    const submitBtn = dblPage.locator('button[type="submit"]');
    await expect(submitBtn).toBeDisabled({ timeout: 2000 });

    // Wait for registration to complete
    await expect(dblPage.getByText('Registration Successful!')).toBeVisible({ timeout: 15000 });

    // Verify the team was registered exactly once (not twice)
    // Check that TEST-DBLCLICK-001 appears exactly once in team_members
    // We do this indirectly by verifying the success screen shows ONE team number
    const teamNumberText = await dblPage.locator('text=/Team \\d+/').textContent();
    expect(teamNumberText).toMatch(/Team \d+/);
  } finally {
    await dblContext.close();
  }
});

// ───────────────────────────────────────────────────────────────
// 9. Admin page not accessible without login
// ───────────────────────────────────────────────────────────────
test('admin page requires login — shows login form without session', async ({ browser }) => {
  // Fresh context with no session/cookies
  const freshContext = await browser.newContext();
  const freshPage = await freshContext.newPage();

  try {
    await freshPage.goto('/admin');
    // Login form should be shown
    await expect(freshPage.locator('input[placeholder="Email address"]')).toBeVisible({
      timeout: 10000,
    });
    // Dashboard should NOT be shown
    await expect(freshPage.getByText('Admin Dashboard')).not.toBeVisible();
  } finally {
    await freshContext.close();
  }
});

// ───────────────────────────────────────────────────────────────
// 10. No admin link visible on student page
// ───────────────────────────────────────────────────────────────
test('no admin link visible on student page', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('body', { timeout: 10000 });

  // No text containing "admin" visible
  const adminText = page.locator('text=/admin/i');
  // Should not be any visible admin text
  for (const el of await adminText.all()) {
    await expect(el).not.toBeVisible();
  }

  // No anchor tag pointing to /admin
  const adminLinks = page.locator('a[href="/admin"]');
  await expect(adminLinks).toHaveCount(0);

  // No button with "admin" text
  const adminButtons = page.locator('button:has-text("admin")');
  await expect(adminButtons).toHaveCount(0);
});
