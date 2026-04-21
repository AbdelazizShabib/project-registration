import { createClient } from '@supabase/supabase-js';

// Playwright loads .env before running tests but NOT during --list / discovery.
// Create the client lazily so importing this file never throws.
let _client;

function db() {
  if (!_client) {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error(
        'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
          'Ensure your .env file is present at the project root.'
      );
    }
    _client = createClient(url, key);
  }
  return _client;
}

export const ADMIN_EMAIL =
  process.env.TEST_ADMIN_EMAIL || 'abdelazizshabib@gmail.com';
export const ADMIN_PASSWORD =
  process.env.TEST_ADMIN_PASSWORD || 'aA$KpSsM9K5v)2c';

async function signInAdmin() {
  const { error } = await db().auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (error) throw new Error(`Admin sign-in failed: ${error.message}`);
}

export async function createTestProject(name, maxTeams = 5) {
  await signInAdmin();
  const { data, error } = await db()
    .from('projects')
    .insert({
      name,
      description: 'Test project — safe to delete',
      max_teams: maxTeams,
      display_order: 9999,
    })
    .select()
    .single();
  if (error) throw new Error(`createTestProject failed: ${error.message}`);
  return data;
}

/**
 * Register a team directly via the register_team RPC.
 * Used to pre-populate data without going through the browser UI.
 */
export async function registerTestTeam(projectId, members) {
  const { data, error } = await db().rpc('register_team', {
    p_project_id: projectId,
    p_members: members,
  });
  if (error) throw new Error(`registerTestTeam RPC error: ${error.message}`);
  if (!data.success) throw new Error(`registerTestTeam failed: ${data.error}`);
  return data;
}

export async function cleanupTestData() {
  await signInAdmin();

  // Collect all test project IDs
  const { data: testProjects } = await db()
    .from('projects')
    .select('id')
    .like('name', '__TEST_%');

  const projectIds = testProjects?.map((p) => p.id) ?? [];

  // Collect all team IDs belonging to test projects
  let teamIds = [];
  if (projectIds.length > 0) {
    const { data: projectTeams } = await db()
      .from('teams')
      .select('id')
      .in('project_id', projectIds);
    teamIds = projectTeams?.map((t) => t.id) ?? [];
  }

  // Also collect teams via TEST- reg numbers (catches teams not linked to __TEST_ projects)
  const { data: testMembers } = await db()
    .from('team_members')
    .select('team_id')
    .like('registration_number', 'TEST-%');
  const regTeamIds = testMembers?.map((m) => m.team_id) ?? [];
  const allTeamIds = [...new Set([...teamIds, ...regTeamIds])];

  // Delete in FK order: team_members → teams → projects
  if (allTeamIds.length > 0) {
    await db().from('team_members').delete().in('team_id', allTeamIds);
    await db().from('teams').delete().in('id', allTeamIds);
  }

  if (projectIds.length > 0) {
    await db().from('projects').delete().in('id', projectIds);
  }

  await db().auth.signOut();
}

export async function setRegistrationOpen(open) {
  await signInAdmin();
  const { error } = await db()
    .from('config')
    .update({ registration_open: open })
    .eq('id', 1);
  if (error) throw new Error(`setRegistrationOpen failed: ${error.message}`);
  await db().auth.signOut();
}

export async function setConfig(updates) {
  await signInAdmin();
  const { error } = await db().from('config').update(updates).eq('id', 1);
  if (error) throw new Error(`setConfig failed: ${error.message}`);
  await db().auth.signOut();
}

export async function getConfig() {
  const { data, error } = await db()
    .from('config')
    .select('*')
    .eq('id', 1)
    .single();
  if (error) throw new Error(`getConfig failed: ${error.message}`);
  return data;
}

export async function getMaxTeamNumber() {
  const { data } = await db()
    .from('teams')
    .select('team_number')
    .order('team_number', { ascending: false })
    .limit(1)
    .single();
  return data?.team_number ?? 0;
}

/**
 * Log in to the admin dashboard via the browser UI.
 */
export async function loginAsAdmin(page) {
  await page.goto('/admin');
  await page.fill('input[placeholder="Email address"]', ADMIN_EMAIL);
  await page.fill('input[placeholder="Password"]', ADMIN_PASSWORD);
  await page.click('button:has-text("Sign in")');
  await page.waitForSelector('text=Admin Dashboard', { timeout: 15000 });
}

/**
 * Navigate to a specific admin sidebar tab.
 */
export async function goToAdminTab(page, tabName) {
  await page.click(`button:has-text("${tabName}")`);
  await page.waitForTimeout(300);
}
