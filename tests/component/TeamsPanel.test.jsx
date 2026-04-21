import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TeamsPanel from '../../src/components/TeamsPanel';

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from '../../src/lib/supabase';

const sampleProjects = [
  { id: 'p1', name: 'Project Alpha' },
  { id: 'p2', name: 'Project Beta' },
];

const sampleTeams = [
  {
    id: 't1',
    team_number: 1,
    created_at: '2024-01-15T10:00:00.000Z',
    project_id: 'p1',
    projects: { name: 'Project Alpha' },
  },
  {
    id: 't2',
    team_number: 2,
    created_at: '2024-01-16T10:00:00.000Z',
    project_id: 'p2',
    projects: { name: 'Project Beta' },
  },
];

const sampleMembers = [
  { id: 'm1', team_id: 't1', member_name: 'Alice Smith', registration_number: 'REG-001' },
  { id: 'm2', team_id: 't1', member_name: 'Bob Jones', registration_number: 'REG-002' },
  { id: 'm3', team_id: 't2', member_name: 'Carol Davis', registration_number: 'REG-003' },
];

function setupMocks(options = {}) {
  const {
    teams = sampleTeams,
    members = sampleMembers,
    projects = sampleProjects,
    deleteError = null,
  } = options;

  // Use mutable arrays so delete can modify them
  let currentTeams = [...teams];
  let currentMembers = [...members];

  const mockDeleteEq = vi.fn().mockImplementation((field, val) => {
    currentTeams = currentTeams.filter((t) => t.id !== val);
    currentMembers = currentMembers.filter((m) => m.team_id !== val);
    return Promise.resolve({ error: deleteError });
  });
  const mockDelete = vi.fn().mockReturnValue({ eq: mockDeleteEq });

  supabase.from.mockImplementation((table) => {
    if (table === 'projects') {
      return {
        select: () => ({
          order: () => Promise.resolve({ data: projects, error: null }),
        }),
      };
    }
    if (table === 'teams') {
      return {
        select: () => Promise.resolve({ data: currentTeams, error: null }),
        delete: mockDelete,
      };
    }
    if (table === 'team_members') {
      return {
        select: () => Promise.resolve({ data: currentMembers, error: null }),
      };
    }
    return { select: () => Promise.resolve({ data: [], error: null }) };
  });

  return { mockDelete, mockDeleteEq };
}

describe('TeamsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
  });

  it('renders team table with correct columns', async () => {
    setupMocks();
    render(<TeamsPanel />);

    await waitFor(() => {
      // Use role-based queries for column headers to avoid matching data cells
      expect(screen.getByRole('columnheader', { name: /Team #/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /Project/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /Members/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /Date/i })).toBeInTheDocument();
    });
  });

  it('renders team data rows', async () => {
    setupMocks();
    render(<TeamsPanel />);

    await waitFor(() => {
      // Team numbers in badges
      expect(screen.getByText('Team 1')).toBeInTheDocument();
      expect(screen.getByText('Team 2')).toBeInTheDocument();
      // Project names in data cells
      expect(screen.getAllByText('Project Alpha').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Project Beta').length).toBeGreaterThanOrEqual(1);
      // Member names
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.getByText('Carol Davis')).toBeInTheDocument();
    });
  });

  it('delete button shows confirmation dialog', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    setupMocks();
    const user = userEvent.setup();
    render(<TeamsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Team 1')).toBeInTheDocument();
    });

    // Find delete buttons by their title attribute
    const deleteButtons = screen.getAllByTitle('Delete Team');
    await user.click(deleteButtons[0]);

    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining('Team 1')
    );
  });

  it('delete removes team from table after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    setupMocks();
    const user = userEvent.setup();
    render(<TeamsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Team 1')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete Team');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.queryByText('Team 1')).not.toBeInTheDocument();
    });
  });

  it('delete does not remove team when canceled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    setupMocks();
    const user = userEvent.setup();
    render(<TeamsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Team 1')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Delete Team');
    await user.click(deleteButtons[0]);

    // Team should still be visible
    expect(screen.getByText('Team 1')).toBeInTheDocument();
  });

  it('filter by project shows only matching teams', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<TeamsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Team 1')).toBeInTheDocument();
      expect(screen.getByText('Team 2')).toBeInTheDocument();
    });

    // The filter select has an "All Projects" option
    const filterSelect = screen.getByRole('combobox');
    await user.selectOptions(filterSelect, 'p1');

    await waitFor(() => {
      expect(screen.getByText('Team 1')).toBeInTheDocument();
      expect(screen.queryByText('Team 2')).not.toBeInTheDocument();
    });
  });

  it('search by member name filters results', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<TeamsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.getByText('Carol Davis')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by name/i);
    await user.type(searchInput, 'Alice');

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.queryByText('Carol Davis')).not.toBeInTheDocument();
    });
  });

  it('search by registration number filters results', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<TeamsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Team 1')).toBeInTheDocument();
      expect(screen.getByText('Team 2')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by name/i);
    await user.type(searchInput, 'REG-003');

    await waitFor(() => {
      // Team 2 has REG-003
      expect(screen.getByText('Team 2')).toBeInTheDocument();
      expect(screen.queryByText('Team 1')).not.toBeInTheDocument();
    });
  });

  it('shows no teams message when filtered results are empty', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<TeamsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Team 1')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by name/i);
    await user.type(searchInput, 'NONEXISTENT_XYZ_12345');

    await waitFor(() => {
      expect(
        screen.getByText(/No teams found matching your criteria/i)
      ).toBeInTheDocument();
    });
  });

  it('Manual Registration button opens modal', async () => {
    // Set up full mock including config (ManualRegister opens StudentForm)
    supabase.from.mockImplementation((table) => {
      if (table === 'projects') {
        return {
          select: () => ({
            order: () => Promise.resolve({ data: sampleProjects, error: null }),
          }),
        };
      }
      if (table === 'teams') {
        return {
          select: () => Promise.resolve({ data: sampleTeams, error: null }),
          delete: vi.fn().mockReturnValue({ eq: vi.fn() }),
        };
      }
      if (table === 'team_members') {
        return {
          select: () => Promise.resolve({ data: sampleMembers, error: null }),
        };
      }
      if (table === 'config') {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    members_per_team: 3,
                    allow_incomplete_teams: false,
                    min_members_per_team: null,
                  },
                  error: null,
                }),
            }),
          }),
        };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    });

    const user = userEvent.setup();
    render(<TeamsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Team 1')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Manual Registration/i }));

    await waitFor(() => {
      expect(screen.getByText('Manual Team Registration')).toBeInTheDocument();
    });
  });
});
