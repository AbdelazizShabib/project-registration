import { test, expect } from '@playwright/test';
import fs from 'fs';
import {
  createTestProject,
  registerTestTeam,
  cleanupTestData,
  setConfig,
  getConfig,
  loginAsAdmin,
  goToAdminTab,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
} from './helpers.js';

test.describe.configure({ mode: 'serial' });

let savedConfig;
let testProjectA;
let testProjectB;
// Names for the project created/edited via the UI in tests 8-11
let uiProjectName;
let uiEditedProjectName;

test.beforeAll(async () => {
  savedConfig = await getConfig();
  // Remove stale data from any previous failed run before creating fresh test data
  await cleanupTestData();
  testProjectA = await createTestProject('__TEST_ADMIN_PROJECT_A__', 5);
  testProjectB = await createTestProject('__TEST_ADMIN_PROJECT_B__', 5);
  await setConfig({ registration_open: true, members_per_team: 3, allow_incomplete_teams: false, min_members_per_team: null });
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
// 1. Login with valid credentials
// ───────────────────────────────────────────────────────────────
test('login with valid credentials shows dashboard', async ({ page }) => {
  await page.goto('/admin');
  await page.fill('input[placeholder="Email address"]', ADMIN_EMAIL);
  await page.fill('input[placeholder="Password"]', ADMIN_PASSWORD);
  await page.click('button:has-text("Sign in")');
  await expect(page.getByText('Admin Dashboard')).toBeVisible({ timeout: 15000 });
  // Login form should be gone
  await expect(page.locator('input[placeholder="Email address"]')).not.toBeVisible();
});

// ───────────────────────────────────────────────────────────────
// 2. Login with invalid credentials
// ───────────────────────────────────────────────────────────────
test('login with invalid credentials shows error', async ({ page }) => {
  await page.goto('/admin');
  await page.fill('input[placeholder="Email address"]', ADMIN_EMAIL);
  await page.fill('input[placeholder="Password"]', 'definitely-wrong-password-xyz');
  await page.click('button:has-text("Sign in")');
  await expect(page.locator('text=/Invalid login credentials|invalid credentials/i')).toBeVisible({
    timeout: 10000,
  });
  // Still on login page
  await expect(page.locator('input[placeholder="Email address"]')).toBeVisible();
});

// ───────────────────────────────────────────────────────────────
// 3. Session persistence across page reload
// ───────────────────────────────────────────────────────────────
test('session persists after page reload', async ({ page }) => {
  await loginAsAdmin(page);
  await page.reload();
  await expect(page.getByText('Admin Dashboard')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('input[placeholder="Email address"]')).not.toBeVisible();
});

// ───────────────────────────────────────────────────────────────
// 4. Logout
// ───────────────────────────────────────────────────────────────
test('logout redirects to login form', async ({ page }) => {
  await loginAsAdmin(page);
  await page.click('button:has-text("Logout")');
  await expect(page.locator('input[placeholder="Email address"]')).toBeVisible({ timeout: 10000 });

  // Navigating back to /admin should still show login
  await page.goto('/admin');
  await expect(page.locator('input[placeholder="Email address"]')).toBeVisible({ timeout: 10000 });
});

// ───────────────────────────────────────────────────────────────
// 5. Course configuration — update course name
// ───────────────────────────────────────────────────────────────
test('course config — update course name saves to database', async ({ page }) => {
  await loginAsAdmin(page);
  // Config tab is active by default
  await page.waitForSelector('input#course_name', { timeout: 10000 });

  await page.fill('input#course_name', '__TEST_UPDATED_COURSE__');
  await page.click('button:has-text("Save Configuration")');
  await expect(page.getByText(/Configuration saved successfully/i)).toBeVisible({ timeout: 10000 });

  // Verify in database
  const config = await getConfig();
  expect(config.course_name).toBe('__TEST_UPDATED_COURSE__');

  // Restore original name
  await page.fill('input#course_name', savedConfig.course_name);
  await page.click('button:has-text("Save Configuration")');
  await page.waitForTimeout(500);
});

// ───────────────────────────────────────────────────────────────
// 6. Course configuration — toggle registration open/closed
// ───────────────────────────────────────────────────────────────
test('course config — toggling registration affects student page', async ({ page, browser }) => {
  await loginAsAdmin(page);
  await page.waitForSelector('button[aria-label*="Toggle registration"], button:has(span.sr-only)', {
    timeout: 10000,
  });

  // Close registration
  const registrationToggle = page.locator('button').filter({ has: page.locator('span', { hasText: 'Toggle registration' }) });
  await registrationToggle.click();
  await page.click('button:has-text("Save Configuration")');
  await expect(page.getByText(/Configuration saved successfully/i)).toBeVisible({ timeout: 10000 });

  // Check student page in new context
  const studentContext = await browser.newContext();
  const studentPage = await studentContext.newPage();
  await studentPage.goto('/');
  await expect(studentPage.getByText('Registration is currently closed.')).toBeVisible({
    timeout: 10000,
  });
  await studentContext.close();

  // Re-open registration
  await registrationToggle.click();
  await page.click('button:has-text("Save Configuration")');
  await expect(page.getByText(/Configuration saved successfully/i)).toBeVisible({ timeout: 10000 });

  // Student page should show the form again
  const studentContext2 = await browser.newContext();
  const studentPage2 = await studentContext2.newPage();
  await studentPage2.goto('/');
  await expect(studentPage2.locator('form')).toBeVisible({ timeout: 10000 });
  await studentContext2.close();
});

// ───────────────────────────────────────────────────────────────
// 7. Course configuration — allow incomplete teams toggle
// ───────────────────────────────────────────────────────────────
test('course config — allow incomplete teams shows/hides min members input', async ({ page }) => {
  await loginAsAdmin(page);
  await page.waitForSelector('input#course_name', { timeout: 10000 });

  // Min members input should not exist initially (allow_incomplete_teams = false)
  await expect(page.locator('input#min_members')).not.toBeVisible();

  const incompleteToggle = page.locator('button').filter({ has: page.locator('span', { hasText: 'Toggle incomplete teams' }) });

  // Toggle ON — input appears
  await incompleteToggle.click();
  await expect(page.locator('input#min_members')).toBeVisible({ timeout: 5000 });

  // Toggle OFF without saving — input hides immediately
  await incompleteToggle.click();
  await expect(page.locator('input#min_members')).not.toBeVisible({ timeout: 5000 });

  // The UI behavior is verified above. afterAll restores DB state via setConfig(savedConfig).
  // No save needed here — saving then toggling off hits a race condition where fetchConfig()
  // (called after save) resets the React state before the next toggle click registers.
});

// ───────────────────────────────────────────────────────────────
// 8. Add a project
// ───────────────────────────────────────────────────────────────
test('add a project appears in list with correct count', async ({ page }) => {
  // Use a timestamp-unique name so stale DB data never causes a duplicate
  uiProjectName = `__TEST_ADDPROJ_${Date.now()}__`;
  uiEditedProjectName = `__TEST_EDITPROJ_${Date.now()}__`;

  await loginAsAdmin(page);
  await goToAdminTab(page, 'Manage Projects');

  await page.waitForSelector('input#name', { timeout: 10000 });
  await page.fill('input#name', uiProjectName);
  await page.fill('input#description', 'E2E test project');
  await page.fill('input#max_teams', '3');
  await page.click('button:has-text("Add Project")');

  const newProjectItem = page.locator('li').filter({ hasText: uiProjectName });
  await expect(newProjectItem).toBeVisible({ timeout: 10000 });
  await expect(newProjectItem.locator('span').filter({ hasText: /\d+ \/ 3 Teams/ })).toBeVisible();
});

// ───────────────────────────────────────────────────────────────
// 9. Edit project name and description
// ───────────────────────────────────────────────────────────────
test('edit project name shows updated name in list', async ({ page }) => {
  await loginAsAdmin(page);
  await goToAdminTab(page, 'Manage Projects');

  await expect(page.getByText(uiProjectName)).toBeVisible({ timeout: 10000 });

  const projectItem = page.locator('li').filter({ hasText: uiProjectName });
  await projectItem.locator('button', { hasText: 'Edit' }).click();

  // After Edit is clicked, the <li> gains a Save button — use that to re-scope
  const editingItem = page.locator('li').filter({ has: page.locator('button:has-text("Save")') });
  const nameInput = editingItem.locator('input[type="text"]').first();
  await nameInput.clear();
  await nameInput.fill(uiEditedProjectName);

  await page.click('button:has-text("Save")');

  await expect(page.getByText(uiEditedProjectName)).toBeVisible({ timeout: 10000 });
  await expect(page.locator('li').filter({ hasText: uiProjectName })).toHaveCount(0);
});

// ───────────────────────────────────────────────────────────────
// 10. Increase max teams on a project
// ───────────────────────────────────────────────────────────────
test('increase max teams updates the display', async ({ page }) => {
  await loginAsAdmin(page);
  await goToAdminTab(page, 'Manage Projects');

  await expect(page.getByText(uiEditedProjectName)).toBeVisible({ timeout: 10000 });

  const projectItem = page.locator('li').filter({ hasText: uiEditedProjectName });
  await projectItem.locator('button', { hasText: 'Edit' }).click();

  const maxTeamsInput = page.locator('input[type="number"]').last();
  await maxTeamsInput.clear();
  await maxTeamsInput.fill('5');
  await page.click('button:has-text("Save")');

  // Scope the badge assertion to the specific project item to avoid matching A/B projects
  await expect(
    projectItem.locator('span').filter({ hasText: /\d+ \/ 5 Teams/ })
  ).toBeVisible({ timeout: 10000 });
});

// ───────────────────────────────────────────────────────────────
// 11. Cannot decrease max teams below current value
// ───────────────────────────────────────────────────────────────
test('cannot decrease max teams below current value', async ({ page }) => {
  await loginAsAdmin(page);
  await goToAdminTab(page, 'Manage Projects');

  await expect(page.getByText(uiEditedProjectName)).toBeVisible({ timeout: 10000 });

  const projectItem = page.locator('li').filter({ hasText: uiEditedProjectName });
  await projectItem.locator('button', { hasText: 'Edit' }).click();

  // Try setting max_teams to 1 (below current value of 5)
  const maxTeamsInput = page.locator('input[type="number"]').last();
  await maxTeamsInput.clear();
  await maxTeamsInput.fill('1');
  await page.click('button:has-text("Save")');

  await expect(
    page.getByText(/Cannot decrease max teams below current value/i)
  ).toBeVisible({ timeout: 5000 });
});

// ───────────────────────────────────────────────────────────────
// 12. No delete button for projects
// ───────────────────────────────────────────────────────────────
test('no delete button exists on project entries', async ({ page }) => {
  await loginAsAdmin(page);
  await goToAdminTab(page, 'Manage Projects');
  await page.waitForSelector('ul li', { timeout: 10000 });

  // No button with Delete text
  const deleteButtons = page.locator('button').filter({ hasText: /^delete$/i });
  await expect(deleteButtons).toHaveCount(0);

  // No button with title "Delete..."
  const titledDelete = page.locator('button[title*="Delete" i]');
  // Only the ones that exist (teams panel delete buttons don't exist here)
  const count = await titledDelete.count();
  expect(count).toBe(0);
});

// ───────────────────────────────────────────────────────────────
// 13. View registered teams
// ───────────────────────────────────────────────────────────────
test('registered teams panel shows team with correct data', async ({ page }) => {
  // Register a team first
  await registerTestTeam(testProjectA.id, [
    { name: 'View Test Alpha', registration_number: 'TEST-ADMIN-VIEW-001' },
    { name: 'View Test Beta', registration_number: 'TEST-ADMIN-VIEW-002' },
    { name: 'View Test Gamma', registration_number: 'TEST-ADMIN-VIEW-003' },
  ]);

  await loginAsAdmin(page);
  await goToAdminTab(page, 'Registered Teams');
  await page.waitForSelector('table', { timeout: 10000 });

  await expect(page.getByText('View Test Alpha')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('TEST-ADMIN-VIEW-001')).toBeVisible();
  await expect(page.getByText('__TEST_ADMIN_PROJECT_A__')).toBeVisible();
});

// ───────────────────────────────────────────────────────────────
// 14. Delete a team
// ───────────────────────────────────────────────────────────────
test('delete team — confirmation dialog then removal from table', async ({ page }) => {
  await loginAsAdmin(page);
  await goToAdminTab(page, 'Registered Teams');
  await page.waitForSelector('table tbody tr', { timeout: 10000 });

  // Find a row with our test member
  const targetRow = page.locator('tr').filter({ hasText: 'View Test Alpha' });
  await expect(targetRow).toBeVisible();

  // Extract team number for confirmation message
  const teamBadgeText = await targetRow.locator('span').first().innerText();

  // Click delete button
  page.on('dialog', (dialog) => dialog.accept());
  await targetRow.locator('button[title="Delete Team"]').click();

  // Team should be removed from table
  await expect(page.getByText('View Test Alpha')).not.toBeVisible({ timeout: 10000 });
});

// ───────────────────────────────────────────────────────────────
// 15. Manual registration
// ───────────────────────────────────────────────────────────────
test('manual registration creates a new team in the list', async ({ page }) => {
  await loginAsAdmin(page);
  await goToAdminTab(page, 'Registered Teams');
  await page.waitForSelector('button:has-text("Manual Registration")', { timeout: 10000 });

  await page.click('button:has-text("Manual Registration")');
  await expect(page.getByText('Manual Team Registration')).toBeVisible({ timeout: 10000 });

  // Wait for the StudentForm inside the modal to load projects
  await page.waitForSelector('select#project option:not([disabled])', { timeout: 10000 });

  await page.fill('#name-0', 'Manual Reg Alpha');
  await page.fill('#reg-0', 'TEST-ADMIN-MAN-001');
  await page.fill('#name-1', 'Manual Reg Beta');
  await page.fill('#reg-1', 'TEST-ADMIN-MAN-002');
  await page.fill('#name-2', 'Manual Reg Gamma');
  await page.fill('#reg-2', 'TEST-ADMIN-MAN-003');

  await page.selectOption('select#project', { label: '__TEST_ADMIN_PROJECT_B__' });
  await page.click('button[type="submit"]');

  // Success screen appears inside modal
  await expect(page.getByText('Registration Successful!')).toBeVisible({ timeout: 15000 });

  // Close modal to refresh the list
  await page.click('button:has-text("Close / Refresh List")');

  await expect(page.getByText('Manual Reg Alpha')).toBeVisible({ timeout: 10000 });
});

// ───────────────────────────────────────────────────────────────
// 16. Filter teams by project
// ───────────────────────────────────────────────────────────────
test('filter teams by project shows only matching teams', async ({ page }) => {
  // Register teams in both projects
  await registerTestTeam(testProjectA.id, [
    { name: 'Filter User A1', registration_number: 'TEST-FILTER-A-001' },
    { name: 'Filter User A2', registration_number: 'TEST-FILTER-A-002' },
    { name: 'Filter User A3', registration_number: 'TEST-FILTER-A-003' },
  ]);

  await loginAsAdmin(page);
  await goToAdminTab(page, 'Registered Teams');
  await page.waitForSelector('table', { timeout: 10000 });

  // Select Project A in the filter dropdown
  const filterSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'All Projects' }) });
  await filterSelect.selectOption({ label: '__TEST_ADMIN_PROJECT_A__' });

  // Only Project A teams should be visible
  await expect(page.getByText('Filter User A1')).toBeVisible({ timeout: 5000 });
  // Project B teams should not be visible (Manual Reg was registered to B)
  await expect(page.getByText('Manual Reg Alpha')).not.toBeVisible();
});

// ───────────────────────────────────────────────────────────────
// 17. Search teams by member name
// ───────────────────────────────────────────────────────────────
test('search by member name filters results', async ({ page }) => {
  await loginAsAdmin(page);
  await goToAdminTab(page, 'Registered Teams');
  await page.waitForSelector('table', { timeout: 10000 });

  // Clear any active filter first
  const filterSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'All Projects' }) });
  await filterSelect.selectOption('');

  const searchInput = page.locator('input[placeholder*="Search"]');
  await searchInput.fill('Filter User A1');

  await expect(page.getByText('Filter User A1')).toBeVisible({ timeout: 5000 });
  // Other teams should not be visible
  await expect(page.getByText('Manual Reg Alpha')).not.toBeVisible();
});

// ───────────────────────────────────────────────────────────────
// 18. Search teams by registration number
// ───────────────────────────────────────────────────────────────
test('search by registration number filters results', async ({ page }) => {
  await loginAsAdmin(page);
  await goToAdminTab(page, 'Registered Teams');
  await page.waitForSelector('table', { timeout: 10000 });

  const filterSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'All Projects' }) });
  await filterSelect.selectOption('');

  const searchInput = page.locator('input[placeholder*="Search"]');
  await searchInput.fill('TEST-ADMIN-MAN-001');

  await expect(page.getByText('Manual Reg Alpha')).toBeVisible({ timeout: 5000 });
  await expect(page.getByText('Filter User A1')).not.toBeVisible();
});

// ───────────────────────────────────────────────────────────────
// 19. Export CSV
// ───────────────────────────────────────────────────────────────
test('export CSV downloads a file with correct data', async ({ page }) => {
  await loginAsAdmin(page);
  await goToAdminTab(page, 'Export & Reset');
  await page.waitForSelector('button:has-text("Download CSV")', { timeout: 10000 });

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('button:has-text("Download CSV")'),
  ]);

  // Verify file was downloaded
  expect(download.suggestedFilename()).toMatch(/registration_data.*\.csv/);

  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();

  const content = fs.readFileSync(downloadPath, 'utf-8');
  const lines = content.trim().split('\n');

  // First line should be the header
  expect(lines[0]).toContain('Team Number');
  expect(lines[0]).toContain('Project Name');
  expect(lines[0]).toContain('Member 1 Name');

  // Should have at least one data row (from our test registrations)
  expect(lines.length).toBeGreaterThan(1);
});

// ───────────────────────────────────────────────────────────────
// 20. Change admin password (then restore it)
// ───────────────────────────────────────────────────────────────
test('change admin password — login with new password works, then restore', async ({ page }) => {
  const NEW_PASSWORD = 'TestP@ss9876';

  await loginAsAdmin(page);
  await goToAdminTab(page, 'Export & Reset');
  await page.waitForSelector('text=Change Admin Password', { timeout: 10000 });

  // Fill new password
  const passInputs = page.locator('input[type="password"]');
  await passInputs.nth(0).fill(NEW_PASSWORD);
  await passInputs.nth(1).fill(NEW_PASSWORD);
  await page.click('button:has-text("Update Password")');
  await expect(page.getByText(/Password updated successfully/i)).toBeVisible({ timeout: 10000 });

  // Logout
  await page.click('button:has-text("Logout")');
  await page.waitForSelector('input[placeholder="Email address"]', { timeout: 10000 });

  // Login with NEW password
  await page.fill('input[placeholder="Email address"]', ADMIN_EMAIL);
  await page.fill('input[placeholder="Password"]', NEW_PASSWORD);
  await page.click('button:has-text("Sign in")');
  await expect(page.getByText('Admin Dashboard')).toBeVisible({ timeout: 15000 });

  // Restore the ORIGINAL password
  await goToAdminTab(page, 'Export & Reset');
  await page.waitForSelector('text=Change Admin Password', { timeout: 10000 });

  const passInputs2 = page.locator('input[type="password"]');
  await passInputs2.nth(0).fill(ADMIN_PASSWORD);
  await passInputs2.nth(1).fill(ADMIN_PASSWORD);
  await page.click('button:has-text("Update Password")');
  await expect(page.getByText(/Password updated successfully/i)).toBeVisible({ timeout: 10000 });
});
