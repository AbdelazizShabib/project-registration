# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: student-registration.spec.js >> client-side validation — empty required fields prevent submission
- Location: tests\e2e\student-registration.spec.js:188:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/Please fill in all required fields/i)
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText(/Please fill in all required fields/i)

```

# Test source

```ts
  104 | 
  105 |   await page.click('button[type="submit"]');
  106 | 
  107 |   // Success screen should appear
  108 |   await expect(page.getByText('Registration Successful!')).toBeVisible({ timeout: 15000 });
  109 |   await expect(page.getByText(/Team \d+/)).toBeVisible();
  110 |   await expect(page.getByText('__TEST_PROJECT_MAIN__')).toBeVisible();
  111 | 
  112 |   // Form should be gone
  113 |   await expect(page.locator('form')).not.toBeVisible();
  114 | });
  115 | 
  116 | // ───────────────────────────────────────────────────────────────
  117 | // 4. Duplicate registration number — server rejection
  118 | // ───────────────────────────────────────────────────────────────
  119 | test('duplicate registration number — server rejects and highlights field', async ({ page }) => {
  120 |   // Register a team first with TEST-E2E-DUP-001 via the RPC directly
  121 |   await registerTestTeam(testProject.id, [
  122 |     { name: 'Dup User One', registration_number: 'TEST-E2E-DUP-001' },
  123 |     { name: 'Dup User Two', registration_number: 'TEST-E2E-DUP-002' },
  124 |     { name: 'Dup User Three', registration_number: 'TEST-E2E-DUP-003' },
  125 |   ]);
  126 | 
  127 |   // Open a fresh page and try to register with the same reg number
  128 |   await page.goto('/');
  129 |   await page.waitForSelector('form', { timeout: 10000 });
  130 | 
  131 |   await page.fill('#name-0', 'New User One');
  132 |   await page.fill('#reg-0', 'TEST-E2E-DUP-001'); // duplicate
  133 |   await page.fill('#name-1', 'New User Two');
  134 |   await page.fill('#reg-1', 'TEST-E2E-DUP-999');
  135 |   await page.fill('#name-2', 'New User Three');
  136 |   await page.fill('#reg-2', 'TEST-E2E-DUP-998');
  137 | 
  138 |   await page.selectOption('select#project', { label: '__TEST_PROJECT_MAIN__' });
  139 |   await page.click('button[type="submit"]');
  140 | 
  141 |   // Error about duplicate should appear — use .first() since both the banner and
  142 |   // inline field error match /already registered/i
  143 |   await expect(
  144 |     page.getByText(/already registered/i).first()
  145 |   ).toBeVisible({ timeout: 15000 });
  146 | 
  147 |   // The field with the duplicate reg number should be highlighted (has bg-red-50 class)
  148 |   const dupRegInput = page.locator('#reg-0');
  149 |   await expect(dupRegInput).toHaveClass(/bg-red-50/);
  150 | });
  151 | 
  152 | // ───────────────────────────────────────────────────────────────
  153 | // 5. Full project — greyed out in dropdown
  154 | // ───────────────────────────────────────────────────────────────
  155 | test('full project — disabled in dropdown and shows (Full)', async ({ page }) => {
  156 |   // Use timestamp name to avoid duplicates from previous runs
  157 |   const fullProject = await createTestProject(`__TEST_FULL_${Date.now()}__`, 1);
  158 | 
  159 |   // Register one team for it to fill it
  160 |   await registerTestTeam(fullProject.id, [
  161 |     { name: 'Full P1', registration_number: 'TEST-E2E-FULL-001' },
  162 |     { name: 'Full P2', registration_number: 'TEST-E2E-FULL-002' },
  163 |     { name: 'Full P3', registration_number: 'TEST-E2E-FULL-003' },
  164 |   ]);
  165 | 
  166 |   await page.goto('/');
  167 |   await page.waitForSelector('select#project', { timeout: 10000 });
  168 | 
  169 |   // <option> elements are always "hidden" inside a closed <select> in Playwright,
  170 |   // so use toHaveCount and evaluate() for presence/disabled checks.
  171 |   const fullOption = page.locator(`select#project option[value="${fullProject.id}"]`);
  172 |   await expect(fullOption).toHaveCount(1);
  173 |   const fullText = await fullOption.innerText();
  174 |   expect(fullText).toContain('(Full)');
  175 |   const isDisabled = await fullOption.evaluate((el) => el.disabled);
  176 |   expect(isDisabled).toBe(true);
  177 | 
  178 |   // The main test project should still be selectable — look it up by its known ID
  179 |   const mainOption = page.locator(`select#project option[value="${testProject.id}"]`);
  180 |   await expect(mainOption).toHaveCount(1);
  181 |   const mainIsDisabled = await mainOption.evaluate((el) => el.disabled);
  182 |   expect(mainIsDisabled).toBe(false);
  183 | });
  184 | 
  185 | // ───────────────────────────────────────────────────────────────
  186 | // 6. Client-side validation — empty fields
  187 | // ───────────────────────────────────────────────────────────────
  188 | test('client-side validation — empty required fields prevent submission', async ({ page }) => {
  189 |   await page.goto('/');
  190 |   await page.waitForSelector('form', { timeout: 10000 });
  191 | 
  192 |   // Track if any network request is made to the RPC
  193 |   let rpcCalled = false;
  194 |   page.on('request', (req) => {
  195 |     if (req.url().includes('register_team')) rpcCalled = true;
  196 |   });
  197 | 
  198 |   // Leave all fields empty, click submit
  199 |   await page.click('button[type="submit"]');
  200 | 
  201 |   // Error should appear
  202 |   await expect(
  203 |     page.getByText(/Please fill in all required fields/i)
> 204 |   ).toBeVisible({ timeout: 5000 });
      |     ^ Error: expect(locator).toBeVisible() failed
  205 | 
  206 |   // No RPC should have been called
  207 |   expect(rpcCalled).toBe(false);
  208 | });
  209 | 
  210 | // ───────────────────────────────────────────────────────────────
  211 | // 7. Client-side validation — duplicate reg numbers within form
  212 | // ───────────────────────────────────────────────────────────────
  213 | test('client-side validation — duplicate reg numbers within form show inline error', async ({ page }) => {
  214 |   await page.goto('/');
  215 |   await page.waitForSelector('form', { timeout: 10000 });
  216 | 
  217 |   let rpcCalled = false;
  218 |   page.on('request', (req) => {
  219 |     if (req.url().includes('register_team')) rpcCalled = true;
  220 |   });
  221 | 
  222 |   await page.fill('#name-0', 'Member One');
  223 |   await page.fill('#reg-0', 'TEST-SAME-REG');
  224 |   await page.fill('#name-1', 'Member Two');
  225 |   await page.fill('#reg-1', 'TEST-SAME-REG'); // same as above
  226 |   await page.fill('#name-2', 'Member Three');
  227 |   await page.fill('#reg-2', 'TEST-UNIQUE-REG');
  228 | 
  229 |   await page.selectOption('select#project', { label: '__TEST_PROJECT_MAIN__' });
  230 |   await page.click('button[type="submit"]');
  231 | 
  232 |   await expect(page.getByText(/Duplicate registration number/i)).toBeVisible({ timeout: 5000 });
  233 |   expect(rpcCalled).toBe(false);
  234 | });
  235 | 
  236 | // ───────────────────────────────────────────────────────────────
  237 | // 8. Incomplete teams allowed — partial submission succeeds
  238 | // ───────────────────────────────────────────────────────────────
  239 | test('incomplete teams allowed — submitting with min members succeeds', async ({ page }) => {
  240 |   await setConfig({
  241 |     registration_open: true,
  242 |     members_per_team: 4,
  243 |     allow_incomplete_teams: true,
  244 |     min_members_per_team: 2,
  245 |   });
  246 | 
  247 |   await page.goto('/');
  248 |   await page.waitForSelector('form', { timeout: 10000 });
  249 | 
  250 |   // First 2 groups should be required, last 2 optional
  251 |   await expect(page.getByText('Optional').first()).toBeVisible();
  252 |   // There should be 2 "Optional" badges
  253 |   await expect(page.getByText('Optional')).toHaveCount(2);
  254 | 
  255 |   // Fill only 2 members
  256 |   await page.fill('#name-0', 'Partial One');
  257 |   await page.fill('#reg-0', 'TEST-E2E-PART-001');
  258 |   await page.fill('#name-1', 'Partial Two');
  259 |   await page.fill('#reg-1', 'TEST-E2E-PART-002');
  260 | 
  261 |   await page.selectOption('select#project', { label: '__TEST_PROJECT_MAIN__' });
  262 |   await page.click('button[type="submit"]');
  263 | 
  264 |   await expect(page.getByText('Registration Successful!')).toBeVisible({ timeout: 15000 });
  265 | 
  266 |   // Restore config
  267 |   await setConfig({
  268 |     registration_open: true,
  269 |     members_per_team: 3,
  270 |     allow_incomplete_teams: false,
  271 |     min_members_per_team: null,
  272 |   });
  273 | });
  274 | 
  275 | // ───────────────────────────────────────────────────────────────
  276 | // 9. Incomplete teams — below minimum rejected
  277 | // ───────────────────────────────────────────────────────────────
  278 | test('incomplete teams — below minimum rejected with error', async ({ page }) => {
  279 |   await setConfig({
  280 |     registration_open: true,
  281 |     members_per_team: 4,
  282 |     allow_incomplete_teams: true,
  283 |     min_members_per_team: 2,
  284 |   });
  285 | 
  286 |   await page.goto('/');
  287 |   await page.waitForSelector('form', { timeout: 10000 });
  288 | 
  289 |   // Fill only 1 member (below min of 2)
  290 |   await page.fill('#name-0', 'Solo Member');
  291 |   await page.fill('#reg-0', 'TEST-E2E-SOLO-001');
  292 | 
  293 |   await page.selectOption('select#project', { label: '__TEST_PROJECT_MAIN__' });
  294 |   await page.click('button[type="submit"]');
  295 | 
  296 |   await expect(
  297 |     page.getByText(/Please fill in all required fields for Member 2/i)
  298 |   ).toBeVisible({ timeout: 5000 });
  299 | 
  300 |   // Restore config
  301 |   await setConfig({
  302 |     registration_open: true,
  303 |     members_per_team: 3,
  304 |     allow_incomplete_teams: false,
```