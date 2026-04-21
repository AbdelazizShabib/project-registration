import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfigPanel from '../../src/components/ConfigPanel';

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from '../../src/lib/supabase';

const defaultConfig = {
  id: 1,
  course_name: 'Software Engineering',
  members_per_team: 5,
  allow_incomplete_teams: false,
  min_members_per_team: null,
  registration_open: false,
  updated_at: new Date().toISOString(),
};

function setupMocks(config = defaultConfig, teamsCount = 0) {
  supabase.from.mockImplementation((table) => {
    if (table === 'config') {
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: config, error: null }),
          }),
        }),
        update: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      };
    }
    if (table === 'teams') {
      return {
        select: () => Promise.resolve({ count: teamsCount, error: null }),
      };
    }
    return { select: () => Promise.resolve({ data: [], error: null }) };
  });
}

describe('ConfigPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays current config values', async () => {
    setupMocks();
    render(<ConfigPanel />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Software Engineering')).toBeInTheDocument();
    });
    const numberInputs = screen.getAllByRole('spinbutton');
    const membersInput = numberInputs.find((i) => i.value === '5');
    expect(membersInput).toBeTruthy();
  });

  it('displays registration open toggle state', async () => {
    setupMocks({ ...defaultConfig, registration_open: true });
    render(<ConfigPanel />);

    await waitFor(() => {
      const toggleBtn = screen.getByRole('button', { name: /Toggle registration/i });
      expect(toggleBtn).toHaveClass('bg-indigo-600');
    });
  });

  it('members per team is disabled when registration is open', async () => {
    setupMocks({ ...defaultConfig, registration_open: true });
    render(<ConfigPanel />);

    await waitFor(() => {
      const numberInputs = screen.getAllByRole('spinbutton');
      const membersInput = numberInputs.find((i) => i.value === '5');
      expect(membersInput).toBeDisabled();
    });
  });

  it('members per team is disabled when teams exist', async () => {
    setupMocks(defaultConfig, 3);
    render(<ConfigPanel />);

    await waitFor(() => {
      const numberInputs = screen.getAllByRole('spinbutton');
      const membersInput = numberInputs.find((i) => i.value === '5');
      expect(membersInput).toBeDisabled();
    });
  });

  it('members per team is editable when registration is closed and no teams', async () => {
    setupMocks({ ...defaultConfig, registration_open: false }, 0);
    render(<ConfigPanel />);

    await waitFor(() => {
      const numberInputs = screen.getAllByRole('spinbutton');
      const membersInput = numberInputs.find((i) => i.value === '5');
      expect(membersInput).not.toBeDisabled();
    });
  });

  it('toggling allow_incomplete_teams shows min members field', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<ConfigPanel />);

    await waitFor(() => {
      expect(screen.queryByLabelText(/Minimum Members Per Team/i)).not.toBeInTheDocument();
    });

    const incompleteToggle = screen.getByRole('button', { name: /Toggle incomplete teams/i });
    await user.click(incompleteToggle);

    await waitFor(() => {
      expect(screen.getByLabelText(/Minimum Members Per Team/i)).toBeInTheDocument();
    });
  });

  it('toggling allow_incomplete_teams off hides min members field', async () => {
    setupMocks({ ...defaultConfig, allow_incomplete_teams: true, min_members_per_team: 2 });
    const user = userEvent.setup();
    render(<ConfigPanel />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Minimum Members Per Team/i)).toBeInTheDocument();
    });

    const incompleteToggle = screen.getByRole('button', { name: /Toggle incomplete teams/i });
    await user.click(incompleteToggle);

    await waitFor(() => {
      expect(screen.queryByLabelText(/Minimum Members Per Team/i)).not.toBeInTheDocument();
    });
  });

  it('min members validation: cannot set min_members >= members_per_team', async () => {
    // Start with min_members = 5 which equals members_per_team (invalid)
    setupMocks({ ...defaultConfig, allow_incomplete_teams: true, min_members_per_team: 5 });
    render(<ConfigPanel />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Minimum Members Per Team/i)).toBeInTheDocument();
    });

    // Use fireEvent.submit to bypass HTML constraint validation (max="4" on the input)
    // and let the React handler do its own validation check.
    const form = document.querySelector('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.getByText(/Minimum members must be between 1 and 4/i)
      ).toBeInTheDocument();
    });
  });

  it('min members validation: cannot set min_members < 1', async () => {
    // min_members_per_team: 0 is invalid (< 1)
    setupMocks({ ...defaultConfig, allow_incomplete_teams: true, min_members_per_team: 0 });
    render(<ConfigPanel />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Minimum Members Per Team/i)).toBeInTheDocument();
    });

    const form = document.querySelector('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.getByText(/Minimum members must be between 1 and 4/i)
      ).toBeInTheDocument();
    });
  });

  it('registration toggle changes state visually', async () => {
    setupMocks({ ...defaultConfig, registration_open: false });
    const user = userEvent.setup();
    render(<ConfigPanel />);

    await waitFor(() => {
      const toggleBtn = screen.getByRole('button', { name: /Toggle registration/i });
      expect(toggleBtn).toHaveClass('bg-slate-200');
    });

    const toggleBtn = screen.getByRole('button', { name: /Toggle registration/i });
    await user.click(toggleBtn);

    expect(toggleBtn).toHaveClass('bg-indigo-600');
  });

  it('save calls supabase update with correct data', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

    supabase.from.mockImplementation((table) => {
      if (table === 'config') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: defaultConfig, error: null }),
            }),
          }),
          update: mockUpdate,
        };
      }
      if (table === 'teams') {
        return { select: () => Promise.resolve({ count: 0, error: null }) };
      }
    });

    render(<ConfigPanel />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Software Engineering')).toBeInTheDocument();
    });

    const form = document.querySelector('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('id', 1);
    });
  });
});
