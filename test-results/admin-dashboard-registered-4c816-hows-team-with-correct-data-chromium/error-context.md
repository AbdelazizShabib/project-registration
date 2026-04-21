# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin-dashboard.spec.js >> registered teams panel shows team with correct data
- Location: tests\e2e\admin-dashboard.spec.js:292:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('__TEST_ADMIN_PROJECT_A__')
Expected: visible
Error: strict mode violation: getByText('__TEST_ADMIN_PROJECT_A__') resolved to 2 elements:
    1) <option value="82dffb11-8961-412b-9768-edfc1d4db039">__TEST_ADMIN_PROJECT_A__</option> aka getByRole('combobox')
    2) <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-medium">__TEST_ADMIN_PROJECT_A__</td> aka getByRole('cell', { name: '__TEST_ADMIN_PROJECT_A__' })

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByText('__TEST_ADMIN_PROJECT_A__')

```

# Test source

```ts
  206 | 
  207 |   await expect(page.getByText(uiProjectName)).toBeVisible({ timeout: 10000 });
  208 | 
  209 |   const projectItem = page.locator('li').filter({ hasText: uiProjectName });
  210 |   await projectItem.locator('button', { hasText: 'Edit' }).click();
  211 | 
  212 |   // After Edit is clicked, the <li> gains a Save button — use that to re-scope
  213 |   const editingItem = page.locator('li').filter({ has: page.locator('button:has-text("Save")') });
  214 |   const nameInput = editingItem.locator('input[type="text"]').first();
  215 |   await nameInput.clear();
  216 |   await nameInput.fill(uiEditedProjectName);
  217 | 
  218 |   await page.click('button:has-text("Save")');
  219 | 
  220 |   await expect(page.getByText(uiEditedProjectName)).toBeVisible({ timeout: 10000 });
  221 |   await expect(page.locator('li').filter({ hasText: uiProjectName })).toHaveCount(0);
  222 | });
  223 | 
  224 | // ───────────────────────────────────────────────────────────────
  225 | // 10. Increase max teams on a project
  226 | // ───────────────────────────────────────────────────────────────
  227 | test('increase max teams updates the display', async ({ page }) => {
  228 |   await loginAsAdmin(page);
  229 |   await goToAdminTab(page, 'Manage Projects');
  230 | 
  231 |   await expect(page.getByText(uiEditedProjectName)).toBeVisible({ timeout: 10000 });
  232 | 
  233 |   const projectItem = page.locator('li').filter({ hasText: uiEditedProjectName });
  234 |   await projectItem.locator('button', { hasText: 'Edit' }).click();
  235 | 
  236 |   const maxTeamsInput = page.locator('input[type="number"]').last();
  237 |   await maxTeamsInput.clear();
  238 |   await maxTeamsInput.fill('5');
  239 |   await page.click('button:has-text("Save")');
  240 | 
  241 |   // Scope the badge assertion to the specific project item to avoid matching A/B projects
  242 |   await expect(
  243 |     projectItem.locator('span').filter({ hasText: /\d+ \/ 5 Teams/ })
  244 |   ).toBeVisible({ timeout: 10000 });
  245 | });
  246 | 
  247 | // ───────────────────────────────────────────────────────────────
  248 | // 11. Cannot decrease max teams below current value
  249 | // ───────────────────────────────────────────────────────────────
  250 | test('cannot decrease max teams below current value', async ({ page }) => {
  251 |   await loginAsAdmin(page);
  252 |   await goToAdminTab(page, 'Manage Projects');
  253 | 
  254 |   await expect(page.getByText(uiEditedProjectName)).toBeVisible({ timeout: 10000 });
  255 | 
  256 |   const projectItem = page.locator('li').filter({ hasText: uiEditedProjectName });
  257 |   await projectItem.locator('button', { hasText: 'Edit' }).click();
  258 | 
  259 |   // Try setting max_teams to 1 (below current value of 5)
  260 |   const maxTeamsInput = page.locator('input[type="number"]').last();
  261 |   await maxTeamsInput.clear();
  262 |   await maxTeamsInput.fill('1');
  263 |   await page.click('button:has-text("Save")');
  264 | 
  265 |   await expect(
  266 |     page.getByText(/Cannot decrease max teams below current value/i)
  267 |   ).toBeVisible({ timeout: 5000 });
  268 | });
  269 | 
  270 | // ───────────────────────────────────────────────────────────────
  271 | // 12. No delete button for projects
  272 | // ───────────────────────────────────────────────────────────────
  273 | test('no delete button exists on project entries', async ({ page }) => {
  274 |   await loginAsAdmin(page);
  275 |   await goToAdminTab(page, 'Manage Projects');
  276 |   await page.waitForSelector('ul li', { timeout: 10000 });
  277 | 
  278 |   // No button with Delete text
  279 |   const deleteButtons = page.locator('button').filter({ hasText: /^delete$/i });
  280 |   await expect(deleteButtons).toHaveCount(0);
  281 | 
  282 |   // No button with title "Delete..."
  283 |   const titledDelete = page.locator('button[title*="Delete" i]');
  284 |   // Only the ones that exist (teams panel delete buttons don't exist here)
  285 |   const count = await titledDelete.count();
  286 |   expect(count).toBe(0);
  287 | });
  288 | 
  289 | // ───────────────────────────────────────────────────────────────
  290 | // 13. View registered teams
  291 | // ───────────────────────────────────────────────────────────────
  292 | test('registered teams panel shows team with correct data', async ({ page }) => {
  293 |   // Register a team first
  294 |   await registerTestTeam(testProjectA.id, [
  295 |     { name: 'View Test Alpha', registration_number: 'TEST-ADMIN-VIEW-001' },
  296 |     { name: 'View Test Beta', registration_number: 'TEST-ADMIN-VIEW-002' },
  297 |     { name: 'View Test Gamma', registration_number: 'TEST-ADMIN-VIEW-003' },
  298 |   ]);
  299 | 
  300 |   await loginAsAdmin(page);
  301 |   await goToAdminTab(page, 'Registered Teams');
  302 |   await page.waitForSelector('table', { timeout: 10000 });
  303 | 
  304 |   await expect(page.getByText('View Test Alpha')).toBeVisible({ timeout: 10000 });
  305 |   await expect(page.getByText('TEST-ADMIN-VIEW-001')).toBeVisible();
> 306 |   await expect(page.getByText('__TEST_ADMIN_PROJECT_A__')).toBeVisible();
      |                                                            ^ Error: expect(locator).toBeVisible() failed
  307 | });
  308 | 
  309 | // ───────────────────────────────────────────────────────────────
  310 | // 14. Delete a team
  311 | // ───────────────────────────────────────────────────────────────
  312 | test('delete team — confirmation dialog then removal from table', async ({ page }) => {
  313 |   await loginAsAdmin(page);
  314 |   await goToAdminTab(page, 'Registered Teams');
  315 |   await page.waitForSelector('table tbody tr', { timeout: 10000 });
  316 | 
  317 |   // Find a row with our test member
  318 |   const targetRow = page.locator('tr').filter({ hasText: 'View Test Alpha' });
  319 |   await expect(targetRow).toBeVisible();
  320 | 
  321 |   // Extract team number for confirmation message
  322 |   const teamBadgeText = await targetRow.locator('span').first().innerText();
  323 | 
  324 |   // Click delete button
  325 |   page.on('dialog', (dialog) => dialog.accept());
  326 |   await targetRow.locator('button[title="Delete Team"]').click();
  327 | 
  328 |   // Team should be removed from table
  329 |   await expect(page.getByText('View Test Alpha')).not.toBeVisible({ timeout: 10000 });
  330 | });
  331 | 
  332 | // ───────────────────────────────────────────────────────────────
  333 | // 15. Manual registration
  334 | // ───────────────────────────────────────────────────────────────
  335 | test('manual registration creates a new team in the list', async ({ page }) => {
  336 |   await loginAsAdmin(page);
  337 |   await goToAdminTab(page, 'Registered Teams');
  338 |   await page.waitForSelector('button:has-text("Manual Registration")', { timeout: 10000 });
  339 | 
  340 |   await page.click('button:has-text("Manual Registration")');
  341 |   await expect(page.getByText('Manual Team Registration')).toBeVisible({ timeout: 10000 });
  342 | 
  343 |   // Wait for the StudentForm inside the modal to load projects
  344 |   await page.waitForSelector('select#project option:not([disabled])', { timeout: 10000 });
  345 | 
  346 |   await page.fill('#name-0', 'Manual Reg Alpha');
  347 |   await page.fill('#reg-0', 'TEST-ADMIN-MAN-001');
  348 |   await page.fill('#name-1', 'Manual Reg Beta');
  349 |   await page.fill('#reg-1', 'TEST-ADMIN-MAN-002');
  350 |   await page.fill('#name-2', 'Manual Reg Gamma');
  351 |   await page.fill('#reg-2', 'TEST-ADMIN-MAN-003');
  352 | 
  353 |   await page.selectOption('select#project', { label: '__TEST_ADMIN_PROJECT_B__' });
  354 |   await page.click('button[type="submit"]');
  355 | 
  356 |   // Success screen appears inside modal
  357 |   await expect(page.getByText('Registration Successful!')).toBeVisible({ timeout: 15000 });
  358 | 
  359 |   // Close modal to refresh the list
  360 |   await page.click('button:has-text("Close / Refresh List")');
  361 | 
  362 |   await expect(page.getByText('Manual Reg Alpha')).toBeVisible({ timeout: 10000 });
  363 | });
  364 | 
  365 | // ───────────────────────────────────────────────────────────────
  366 | // 16. Filter teams by project
  367 | // ───────────────────────────────────────────────────────────────
  368 | test('filter teams by project shows only matching teams', async ({ page }) => {
  369 |   // Register teams in both projects
  370 |   await registerTestTeam(testProjectA.id, [
  371 |     { name: 'Filter User A1', registration_number: 'TEST-FILTER-A-001' },
  372 |     { name: 'Filter User A2', registration_number: 'TEST-FILTER-A-002' },
  373 |     { name: 'Filter User A3', registration_number: 'TEST-FILTER-A-003' },
  374 |   ]);
  375 | 
  376 |   await loginAsAdmin(page);
  377 |   await goToAdminTab(page, 'Registered Teams');
  378 |   await page.waitForSelector('table', { timeout: 10000 });
  379 | 
  380 |   // Select Project A in the filter dropdown
  381 |   const filterSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'All Projects' }) });
  382 |   await filterSelect.selectOption({ label: '__TEST_ADMIN_PROJECT_A__' });
  383 | 
  384 |   // Only Project A teams should be visible
  385 |   await expect(page.getByText('Filter User A1')).toBeVisible({ timeout: 5000 });
  386 |   // Project B teams should not be visible (Manual Reg was registered to B)
  387 |   await expect(page.getByText('Manual Reg Alpha')).not.toBeVisible();
  388 | });
  389 | 
  390 | // ───────────────────────────────────────────────────────────────
  391 | // 17. Search teams by member name
  392 | // ───────────────────────────────────────────────────────────────
  393 | test('search by member name filters results', async ({ page }) => {
  394 |   await loginAsAdmin(page);
  395 |   await goToAdminTab(page, 'Registered Teams');
  396 |   await page.waitForSelector('table', { timeout: 10000 });
  397 | 
  398 |   // Clear any active filter first
  399 |   const filterSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'All Projects' }) });
  400 |   await filterSelect.selectOption('');
  401 | 
  402 |   const searchInput = page.locator('input[placeholder*="Search"]');
  403 |   await searchInput.fill('Filter User A1');
  404 | 
  405 |   await expect(page.getByText('Filter User A1')).toBeVisible({ timeout: 5000 });
  406 |   // Other teams should not be visible
```