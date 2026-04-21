import { describe, it, expect } from 'vitest';
import { generateCSV } from '../../src/lib/csvExport';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const makeTeam = (id, teamNumber, projectName) => ({
  id,
  team_number: teamNumber,
  projects: { name: projectName },
});

const makeMember = (teamId, name, regNumber) => ({
  team_id: teamId,
  member_name: name,
  registration_number: regNumber,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('CSV Export — generateCSV', () => {
  it('Empty data produces only the header row', () => {
    const csv = generateCSV([], [], 3);
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(
      'Team Number,Project Name,Member 1 Name,Member 1 Reg Number,Member 2 Name,Member 2 Reg Number,Member 3 Name,Member 3 Reg Number'
    );
  });

  it('Single team, full members — correct columns and values', () => {
    const teams = [makeTeam('t1', 1, 'Alpha')];
    const members = [
      makeMember('t1', 'Alice', 'R001'),
      makeMember('t1', 'Bob', 'R002'),
    ];
    const csv = generateCSV(teams, members, 2);
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('1,"Alpha","Alice","R001","Bob","R002"');
  });

  it('Multiple teams, different projects — each on its own row', () => {
    const teams = [
      makeTeam('t1', 1, 'Alpha'),
      makeTeam('t2', 2, 'Beta'),
    ];
    const members = [
      makeMember('t1', 'Alice', 'R001'),
      makeMember('t2', 'Charlie', 'R003'),
    ];
    const csv = generateCSV(teams, members, 1);
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(3); // header + 2 rows
    expect(lines[1]).toContain('"Alpha"');
    expect(lines[2]).toContain('"Beta"');
  });

  it('Special characters in names — commas, quotes, unicode', () => {
    const teams = [makeTeam('t1', 1, 'Project "X"')];
    const members = [
      makeMember('t1', 'O\'Brien, James', 'R001'),
      makeMember('t1', 'عبدالعزيز', 'R002'),
    ];
    const csv = generateCSV(teams, members, 2);
    const lines = csv.trim().split('\n');
    // Project name with quotes should be escaped as ""
    expect(lines[1]).toContain('"Project ""X"""');
    // Member name with comma and apostrophe
    expect(lines[1]).toContain('"O\'Brien, James"');
    // Unicode characters preserved
    expect(lines[1]).toContain('"عبدالعزيز"');
  });

  it('Incomplete teams — empty columns for missing members', () => {
    const teams = [makeTeam('t1', 1, 'Alpha')];
    const members = [makeMember('t1', 'Alice', 'R001')];
    // members_per_team is 3, but only 1 member
    const csv = generateCSV(teams, members, 3);
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(2);
    // Row: 1,"Alpha","Alice","R001",,,,
    const cols = lines[1].split(',');
    // team_number(1) + project(1 quoted) + 3*2 member cols = 8 cols total
    expect(cols.length).toBe(8);
    // Last 4 cols (member 2 name, member 2 reg, member 3 name, member 3 reg) should be empty
    expect(cols[4]).toBe('');
    expect(cols[5]).toBe('');
    expect(cols[6]).toBe('');
    expect(cols[7]).toBe('');
  });
});
