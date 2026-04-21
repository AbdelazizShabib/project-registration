import { test, expect } from '@playwright/test';
import {
  createTestProject,
  registerTestTeam,
  cleanupTestData,
  setConfig,
  getConfig,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
} from './helpers.js';

test.describe.configure({ mode: 'serial' });

let savedConfig;
let testProject; // primary test project (max_teams: 5)

test.beforeAll(async () => {
  // Persist original config so we can restore it after tests
  savedConfig = await getConfig();

  // Remove stale data from any previous failed run
  await cleanupTestData();

  // Create a test project for most registration tests
  testProject = await createTestProject('__TEST_PROJECT_MAIN__', 5);

  // Set config: registration open, 3 members per team, no incomplete teams
  await setConfig({
    registration_open: true,
    members_per_team: 3,
    allow_incomplete_teams: false,
    min_members_per_team: null,
  });
});

test.afterAll(async () => {
  await cleanupTestData();
  // Restore original config
  await setConfig({
    course_name: savedConfig.course_name,
    registration_open: savedConfig.registration_open,
    allow_incomplete_teams: savedConfig.allow_incomplete_teams,
    min_members_per_team: savedConfig.min_members_per_team,
  });
});

// ───────────────────────────────────────────────────────────────
// 1. Registration closed — shows closed message
// ───────────────────────────────────────────────────────────────
test('registration closed — shows closed message and no form', async ({ page }) => {
  await setConfig({ registration_open: false });

  await page.goto('/');
  await expect(page.getByText('Registration is currently closed.')).toBeVisible({ timeout: 10000 });

  // No form should be visible
  await expect(page.locator('form')).not.toBeVisible();

  // Restore open for subsequent tests
  await setConfig({ registration_open: true });
});

// ───────────────────────────────────────────────────────────────
// 2. Registration open — shows form with correct fields
// ───────────────────────────────────────────────────────────────
test('registration open — shows form with correct number of member fields', async ({ page }) => {
  await setConfig({
    registration_open: true,
    members_per_team: 3,
    allow_incomplete_teams: false,
    min_members_per_team: null,
  });

  await page.goto('/');
  await page.waitForSelector('form', { timeout: 10000 });

  // Should have 3 name inputs and 3 registration number inputs
  const nameInputs = page.locator('input[id^="name-"]');
  const regInputs = page.locator('input[id^="reg-"]');
  await expect(nameInputs).toHaveCount(3);
  await expect(regInputs).toHaveCount(3);

  // Project dropdown visible
  await expect(page.locator('select#project')).toBeVisible();
});

// ───────────────────────────────────────────────────────────────
// 3. Successful registration
// ───────────────────────────────────────────────────────────────
test('successful registration — shows success screen with team number', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('form', { timeout: 10000 });

  // Fill member fields
  await page.fill('#name-0', 'Alice TEST');
  await page.fill('#reg-0', 'TEST-E2E-S001');
  await page.fill('#name-1', 'Bob TEST');
  await page.fill('#reg-1', 'TEST-E2E-S002');
  await page.fill('#name-2', 'Carol TEST');
  await page.fill('#reg-2', 'TEST-E2E-S003');

  // Select test project
  await page.selectOption('select#project', { label: '__TEST_PROJECT_MAIN__' });

  await page.click('button[type="submit"]');

  // Success screen should appear
  await expect(page.getByText('Registration Successful!')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Team \d+/)).toBeVisible();
  await expect(page.getByText('__TEST_PROJECT_MAIN__')).toBeVisible();

  // Form should be gone
  await expect(page.locator('form')).not.toBeVisible();
});

// ───────────────────────────────────────────────────────────────
// 4. Duplicate registration number — server rejection
// ───────────────────────────────────────────────────────────────
test('duplicate registration number — server rejects and highlights field', async ({ page }) => {
  // Register a team first with TEST-E2E-DUP-001 via the RPC directly
  await registerTestTeam(testProject.id, [
    { name: 'Dup User One', registration_number: 'TEST-E2E-DUP-001' },
    { name: 'Dup User Two', registration_number: 'TEST-E2E-DUP-002' },
    { name: 'Dup User Three', registration_number: 'TEST-E2E-DUP-003' },
  ]);

  // Open a fresh page and try to register with the same reg number
  await page.goto('/');
  await page.waitForSelector('form', { timeout: 10000 });

  await page.fill('#name-0', 'New User One');
  await page.fill('#reg-0', 'TEST-E2E-DUP-001'); // duplicate
  await page.fill('#name-1', 'New User Two');
  await page.fill('#reg-1', 'TEST-E2E-DUP-999');
  await page.fill('#name-2', 'New User Three');
  await page.fill('#reg-2', 'TEST-E2E-DUP-998');

  await page.selectOption('select#project', { label: '__TEST_PROJECT_MAIN__' });
  await page.click('button[type="submit"]');

  // Error about duplicate should appear — use .first() since both the banner and
  // inline field error match /already registered/i
  await expect(
    page.getByText(/already registered/i).first()
  ).toBeVisible({ timeout: 15000 });

  // The field with the duplicate reg number should be highlighted (has bg-red-50 class)
  const dupRegInput = page.locator('#reg-0');
  await expect(dupRegInput).toHaveClass(/bg-red-50/);
});

// ───────────────────────────────────────────────────────────────
// 5. Full project — greyed out in dropdown
// ───────────────────────────────────────────────────────────────
test('full project — disabled in dropdown and shows (Full)', async ({ page }) => {
  // Use timestamp name to avoid duplicates from previous runs
  const fullProject = await createTestProject(`__TEST_FULL_${Date.now()}__`, 1);

  // Register one team for it to fill it
  await registerTestTeam(fullProject.id, [
    { name: 'Full P1', registration_number: 'TEST-E2E-FULL-001' },
    { name: 'Full P2', registration_number: 'TEST-E2E-FULL-002' },
    { name: 'Full P3', registration_number: 'TEST-E2E-FULL-003' },
  ]);

  await page.goto('/');
  await page.waitForSelector('select#project', { timeout: 10000 });

  // <option> elements are always "hidden" inside a closed <select> in Playwright,
  // so use toHaveCount and evaluate() for presence/disabled checks.
  const fullOption = page.locator(`select#project option[value="${fullProject.id}"]`);
  await expect(fullOption).toHaveCount(1);
  const fullText = await fullOption.innerText();
  expect(fullText).toContain('(Full)');
  const isDisabled = await fullOption.evaluate((el) => el.disabled);
  expect(isDisabled).toBe(true);

  // The main test project should still be selectable — look it up by its known ID
  const mainOption = page.locator(`select#project option[value="${testProject.id}"]`);
  await expect(mainOption).toHaveCount(1);
  const mainIsDisabled = await mainOption.evaluate((el) => el.disabled);
  expect(mainIsDisabled).toBe(false);
});

// ───────────────────────────────────────────────────────────────
// 6. Client-side validation — empty fields
// ───────────────────────────────────────────────────────────────
test('client-side validation — empty required fields prevent submission', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('form', { timeout: 10000 });

  // Track if any network request is made to the RPC
  let rpcCalled = false;
  page.on('request', (req) => {
    if (req.url().includes('register_team')) rpcCalled = true;
  });

  // Leave all fields empty, click submit
  await page.click('button[type="submit"]');

  // Error should appear
  await expect(
    page.getByText(/Please fill in all required fields/i)
  ).toBeVisible({ timeout: 5000 });

  // No RPC should have been called
  expect(rpcCalled).toBe(false);
});

// ───────────────────────────────────────────────────────────────
// 7. Client-side validation — duplicate reg numbers within form
// ───────────────────────────────────────────────────────────────
test('client-side validation — duplicate reg numbers within form show inline error', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('form', { timeout: 10000 });

  let rpcCalled = false;
  page.on('request', (req) => {
    if (req.url().includes('register_team')) rpcCalled = true;
  });

  await page.fill('#name-0', 'Member One');
  await page.fill('#reg-0', 'TEST-SAME-REG');
  await page.fill('#name-1', 'Member Two');
  await page.fill('#reg-1', 'TEST-SAME-REG'); // same as above
  await page.fill('#name-2', 'Member Three');
  await page.fill('#reg-2', 'TEST-UNIQUE-REG');

  await page.selectOption('select#project', { label: '__TEST_PROJECT_MAIN__' });
  await page.click('button[type="submit"]');

  await expect(page.getByText(/Duplicate registration number/i)).toBeVisible({ timeout: 5000 });
  expect(rpcCalled).toBe(false);
});

// ───────────────────────────────────────────────────────────────
// 8. Incomplete teams allowed — partial submission succeeds
// ───────────────────────────────────────────────────────────────
test('incomplete teams allowed — submitting with min members succeeds', async ({ page }) => {
  await setConfig({
    registration_open: true,
    members_per_team: 4,
    allow_incomplete_teams: true,
    min_members_per_team: 2,
  });

  await page.goto('/');
  await page.waitForSelector('form', { timeout: 10000 });

  // First 2 groups should be required, last 2 optional
  await expect(page.getByText('Optional').first()).toBeVisible();
  // There should be 2 "Optional" badges
  await expect(page.getByText('Optional')).toHaveCount(2);

  // Fill only 2 members
  await page.fill('#name-0', 'Partial One');
  await page.fill('#reg-0', 'TEST-E2E-PART-001');
  await page.fill('#name-1', 'Partial Two');
  await page.fill('#reg-1', 'TEST-E2E-PART-002');

  await page.selectOption('select#project', { label: '__TEST_PROJECT_MAIN__' });
  await page.click('button[type="submit"]');

  await expect(page.getByText('Registration Successful!')).toBeVisible({ timeout: 15000 });

  // Restore config
  await setConfig({
    registration_open: true,
    members_per_team: 3,
    allow_incomplete_teams: false,
    min_members_per_team: null,
  });
});

// ───────────────────────────────────────────────────────────────
// 9. Incomplete teams — below minimum rejected
// ───────────────────────────────────────────────────────────────
test('incomplete teams — below minimum rejected with error', async ({ page }) => {
  await setConfig({
    registration_open: true,
    members_per_team: 4,
    allow_incomplete_teams: true,
    min_members_per_team: 2,
  });

  await page.goto('/');
  await page.waitForSelector('form', { timeout: 10000 });

  // Fill only 1 member (below min of 2)
  await page.fill('#name-0', 'Solo Member');
  await page.fill('#reg-0', 'TEST-E2E-SOLO-001');

  await page.selectOption('select#project', { label: '__TEST_PROJECT_MAIN__' });
  await page.click('button[type="submit"]');

  await expect(
    page.getByText(/Please fill in all required fields for Member 2/i)
  ).toBeVisible({ timeout: 5000 });

  // Restore config
  await setConfig({
    registration_open: true,
    members_per_team: 3,
    allow_incomplete_teams: false,
    min_members_per_team: null,
  });
});

// ───────────────────────────────────────────────────────────────
// 10. Course name displayed on student page
// ───────────────────────────────────────────────────────────────
test('course name displayed on student page', async ({ page }) => {
  await setConfig({ course_name: '__TEST_COURSE_NAME__' });

  await page.goto('/');
  await expect(page.getByText('__TEST_COURSE_NAME__')).toBeVisible({ timeout: 10000 });

  // Restore original course name
  await setConfig({ course_name: savedConfig.course_name });
});
