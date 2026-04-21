import { describe, it, expect } from 'vitest';
import { validateRegistrationForm } from '../../src/lib/validation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const makeMembers = (count, prefix = 'User') =>
  Array.from({ length: count }, (_, i) => ({
    name: `${prefix} ${i + 1}`,
    registration_number: `REG-${prefix}-${i + 1}`,
  }));

const emptySlot = () => ({ name: '', registration_number: '' });

const baseConfig = {
  members_per_team: 3,
  allow_incomplete_teams: false,
  min_members_per_team: null,
};

const sampleProjects = [
  { id: 'p1', name: 'Project A', is_full: false },
  { id: 'p2', name: 'Project B', is_full: true },
];

// ---------------------------------------------------------------------------
// 1. Required fields — all members required (allow_incomplete_teams = false)
// ---------------------------------------------------------------------------
describe('Required fields — all members required', () => {
  const config = { ...baseConfig };

  it('FAIL: any name field is empty string', () => {
    const members = [
      { name: '', registration_number: 'R1' },
      { name: 'B', registration_number: 'R2' },
      { name: 'C', registration_number: 'R3' },
    ];
    const result = validateRegistrationForm(members, config, 'p1', sampleProjects);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Member 1');
  });

  it('FAIL: any name field is whitespace-only', () => {
    const members = [
      { name: '   ', registration_number: 'R1' },
      { name: 'B', registration_number: 'R2' },
      { name: 'C', registration_number: 'R3' },
    ];
    const result = validateRegistrationForm(members, config, 'p1', sampleProjects);
    expect(result.valid).toBe(false);
  });

  it('FAIL: any registration number field is empty', () => {
    const members = [
      { name: 'A', registration_number: '' },
      { name: 'B', registration_number: 'R2' },
      { name: 'C', registration_number: 'R3' },
    ];
    const result = validateRegistrationForm(members, config, 'p1', sampleProjects);
    expect(result.valid).toBe(false);
  });

  it('FAIL: any registration number field is whitespace-only', () => {
    const members = [
      { name: 'A', registration_number: '  ' },
      { name: 'B', registration_number: 'R2' },
      { name: 'C', registration_number: 'R3' },
    ];
    const result = validateRegistrationForm(members, config, 'p1', sampleProjects);
    expect(result.valid).toBe(false);
  });

  it('PASS: all fields filled with valid strings', () => {
    const members = makeMembers(3);
    const result = validateRegistrationForm(members, config, 'p1', sampleProjects);
    expect(result.valid).toBe(true);
    expect(result.validMembers).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// 2. Required fields — incomplete teams allowed
// ---------------------------------------------------------------------------
describe('Required fields — incomplete teams allowed', () => {
  const config = {
    members_per_team: 4,
    allow_incomplete_teams: true,
    min_members_per_team: 2,
  };

  it('FAIL: fewer than min_members_per_team members provided', () => {
    const members = [
      { name: 'A', registration_number: 'R1' },
      emptySlot(),
      emptySlot(),
      emptySlot(),
    ];
    const result = validateRegistrationForm(members, config, 'p1', sampleProjects);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Member 2');
  });

  it('PASS: exactly min_members_per_team members provided', () => {
    const members = [
      { name: 'A', registration_number: 'R1' },
      { name: 'B', registration_number: 'R2' },
      emptySlot(),
      emptySlot(),
    ];
    const result = validateRegistrationForm(members, config, 'p1', sampleProjects);
    expect(result.valid).toBe(true);
    expect(result.validMembers).toHaveLength(2);
  });

  it('PASS: more than min but fewer than max members', () => {
    const members = [
      { name: 'A', registration_number: 'R1' },
      { name: 'B', registration_number: 'R2' },
      { name: 'C', registration_number: 'R3' },
      emptySlot(),
    ];
    const result = validateRegistrationForm(members, config, 'p1', sampleProjects);
    expect(result.valid).toBe(true);
    expect(result.validMembers).toHaveLength(3);
  });

  it('PASS: all members_per_team members provided', () => {
    const members = makeMembers(4);
    const result = validateRegistrationForm(members, config, 'p1', sampleProjects);
    expect(result.valid).toBe(true);
    expect(result.validMembers).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// 3. Duplicate registration numbers within the same form
// ---------------------------------------------------------------------------
describe('Duplicate registration numbers', () => {
  const config = { ...baseConfig };

  it('FAIL: two members have the same registration number', () => {
    const members = [
      { name: 'A', registration_number: 'SAME' },
      { name: 'B', registration_number: 'SAME' },
      { name: 'C', registration_number: 'R3' },
    ];
    const result = validateRegistrationForm(members, config, 'p1', sampleProjects);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Duplicate');
    expect(result.duplicateField).toBe('SAME');
  });

  it('FAIL: same registration number with leading/trailing whitespace', () => {
    const members = [
      { name: 'A', registration_number: ' SAME ' },
      { name: 'B', registration_number: 'SAME' },
      { name: 'C', registration_number: 'R3' },
    ];
    const result = validateRegistrationForm(members, config, 'p1', sampleProjects);
    expect(result.valid).toBe(false);
    expect(result.duplicateField).toBe('SAME');
  });

  it('PASS: all registration numbers are unique', () => {
    const members = makeMembers(3);
    const result = validateRegistrationForm(members, config, 'p1', sampleProjects);
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Project selection
// ---------------------------------------------------------------------------
describe('Project selection', () => {
  const config = { ...baseConfig };
  const members = makeMembers(3);

  it('FAIL: no project selected (empty string)', () => {
    const result = validateRegistrationForm(members, config, '', sampleProjects);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('select a project');
  });

  it('FAIL: no project selected (null)', () => {
    const result = validateRegistrationForm(members, config, null, sampleProjects);
    expect(result.valid).toBe(false);
  });

  it('FAIL: selected project is full', () => {
    const result = validateRegistrationForm(members, config, 'p2', sampleProjects);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('full');
  });

  it('PASS: a valid, available project selected', () => {
    const result = validateRegistrationForm(members, config, 'p1', sampleProjects);
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Input trimming
// ---------------------------------------------------------------------------
describe('Input trimming', () => {
  const config = { ...baseConfig };

  it('Names with leading/trailing whitespace are trimmed', () => {
    const members = [
      { name: '  Alice  ', registration_number: 'R1' },
      { name: '  Bob  ', registration_number: 'R2' },
      { name: '  Carol  ', registration_number: 'R3' },
    ];
    const result = validateRegistrationForm(members, config, 'p1', sampleProjects);
    expect(result.valid).toBe(true);
    expect(result.validMembers[0].name).toBe('Alice');
    expect(result.validMembers[1].name).toBe('Bob');
  });

  it('Registration numbers with leading/trailing whitespace are trimmed', () => {
    const members = [
      { name: 'A', registration_number: '  R1  ' },
      { name: 'B', registration_number: '  R2  ' },
      { name: 'C', registration_number: '  R3  ' },
    ];
    const result = validateRegistrationForm(members, config, 'p1', sampleProjects);
    expect(result.valid).toBe(true);
    expect(result.validMembers[0].registration_number).toBe('R1');
  });
});
