import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectsPanel from '../../src/components/ProjectsPanel';

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from '../../src/lib/supabase';

const sampleProjects = [
  { id: 'p1', name: 'Project Alpha', description: 'First project', max_teams: 3, display_order: 1 },
  { id: 'p2', name: 'Project Beta', description: 'Second project', max_teams: 5, display_order: 2 },
  { id: 'p3', name: 'Project Gamma', description: 'Third project', max_teams: 2, display_order: 3 },
];

const sampleTeams = [
  { project_id: 'p1' },
  { project_id: 'p1' }, // p1 has 2 teams
  { project_id: 'p2' }, // p2 has 1 team
];

function setupMocks({ projects = sampleProjects, teams = sampleTeams, insertError = null, updateError = null } = {}) {
  const mockInsert = vi.fn().mockResolvedValue({ error: insertError });
  const mockUpdateEq = vi.fn().mockResolvedValue({ error: updateError });
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });

  supabase.from.mockImplementation((table) => {
    if (table === 'projects') {
      return {
        select: () => ({
          order: () => Promise.resolve({ data: projects, error: null }),
        }),
        insert: mockInsert,
        update: mockUpdate,
      };
    }
    if (table === 'teams') {
      return {
        select: () => Promise.resolve({ data: teams, error: null }),
      };
    }
    return { select: () => Promise.resolve({ data: [], error: null }) };
  });

  return { mockInsert, mockUpdate, mockUpdateEq };
}

describe('ProjectsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all projects', async () => {
    setupMocks();
    render(<ProjectsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      expect(screen.getByText('Project Beta')).toBeInTheDocument();
      expect(screen.getByText('Project Gamma')).toBeInTheDocument();
    });
  });

  it('shows registered count per project', async () => {
    setupMocks();
    render(<ProjectsPanel />);

    await waitFor(() => {
      // p1: 2/3 Teams, p2: 1/5 Teams, p3: 0/2 Teams
      expect(screen.getByText('2 / 3 Teams')).toBeInTheDocument();
      expect(screen.getByText('1 / 5 Teams')).toBeInTheDocument();
      expect(screen.getByText('0 / 2 Teams')).toBeInTheDocument();
    });
  });

  it('add project form calls Supabase insert', async () => {
    const { mockInsert } = setupMocks();
    const user = userEvent.setup();
    render(<ProjectsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/Project Name/i), '__TEST_NEW_PROJECT__');
    await user.type(screen.getByLabelText(/Description/i), 'A test description');
    const maxTeamsInput = screen.getByLabelText(/Max Teams/i);
    await user.clear(maxTeamsInput);
    await user.type(maxTeamsInput, '4');

    await user.click(screen.getByRole('button', { name: /Add Project/i }));

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          name: '__TEST_NEW_PROJECT__',
          description: 'A test description',
          max_teams: 4,
        }),
      ]);
    });
  });

  it('cannot decrease max_teams below current value', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<ProjectsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    });

    // Click Edit on Project Alpha (max_teams = 3)
    const editButtons = screen.getAllByRole('button', { name: /Edit/i });
    await user.click(editButtons[0]);

    // In edit mode, try to set max_teams below 3
    await waitFor(() => {
      expect(screen.getByText(/Min:/i)).toBeInTheDocument();
    });

    // Find the max_teams edit input (it's a number input in edit mode)
    const numberInputs = screen.getAllByRole('spinbutton');
    const maxTeamsEdit = numberInputs[numberInputs.length - 1]; // last number input in edit form
    await user.clear(maxTeamsEdit);
    await user.type(maxTeamsEdit, '2'); // below original value of 3

    await user.click(screen.getByRole('button', { name: /Save/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Cannot decrease max teams below current value/i)
      ).toBeInTheDocument();
    });
  });

  it('can increase max_teams and calls Supabase update', async () => {
    const { mockUpdate, mockUpdateEq } = setupMocks();
    const user = userEvent.setup();
    render(<ProjectsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole('button', { name: /Edit/i });
    await user.click(editButtons[0]); // Edit Project Alpha

    await waitFor(() => {
      expect(screen.getByText(/Min:/i)).toBeInTheDocument();
    });

    const numberInputs = screen.getAllByRole('spinbutton');
    const maxTeamsEdit = numberInputs[numberInputs.length - 1];
    await user.clear(maxTeamsEdit);
    await user.type(maxTeamsEdit, '6'); // increase from 3 to 6

    await user.click(screen.getByRole('button', { name: /Save/i }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ max_teams: 6 })
      );
      expect(mockUpdateEq).toHaveBeenCalledWith('id', 'p1');
    });
  });

  it('no delete button on project entries', async () => {
    setupMocks();
    render(<ProjectsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    });

    // No button with "Delete" text
    const deleteButtons = screen.queryAllByRole('button', { name: /delete/i });
    expect(deleteButtons).toHaveLength(0);

    // No button with title "Delete"
    const titledDeleteBtns = document.querySelectorAll('button[title*="Delete" i]');
    expect(titledDeleteBtns).toHaveLength(0);
  });

  it('edit project name updates correctly', async () => {
    const { mockUpdate } = setupMocks();
    const user = userEvent.setup();
    render(<ProjectsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Project Beta')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole('button', { name: /Edit/i });
    await user.click(editButtons[1]); // Edit Project Beta

    await waitFor(() => {
      // Find the name text input in edit mode
      const textInputs = screen.getAllByRole('textbox');
      const nameInput = textInputs.find((i) => i.value === 'Project Beta');
      expect(nameInput).toBeTruthy();
    });

    const textInputs = screen.getAllByRole('textbox');
    const nameInput = textInputs.find((i) => i.value === 'Project Beta');
    await user.clear(nameInput);
    await user.type(nameInput, 'Project Beta Renamed');

    await user.click(screen.getByRole('button', { name: /Save/i }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Project Beta Renamed' })
      );
    });
  });

  it('shows empty state when no projects exist', async () => {
    setupMocks({ projects: [], teams: [] });
    render(<ProjectsPanel />);

    await waitFor(() => {
      expect(screen.getByText(/No projects added yet/i)).toBeInTheDocument();
    });
  });
});
