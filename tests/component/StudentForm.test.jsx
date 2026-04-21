import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StudentForm from '../../src/components/StudentForm';

// ---------------------------------------------------------------------------
// Mock Supabase
// ---------------------------------------------------------------------------
const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
    rpc: (...args) => mockRpc(...args),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const sampleProjects = [
  { id: 'p1', name: 'Available Project', description: '', max_teams: 5, display_order: 1 },
  { id: 'p2', name: 'Full Project', description: '', max_teams: 1, display_order: 2 },
];

const sampleTeams = [
  { project_id: 'p2' }, // one team registered to p2 → p2 is full (max_teams=1)
];

function setupMocks() {
  mockFrom.mockImplementation((table) => {
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
      };
    }
    return { select: () => Promise.resolve({ data: [], error: null }) };
  });
}

const renderForm = (configOverrides = {}) => {
  const config = {
    members_per_team: 3,
    allow_incomplete_teams: false,
    min_members_per_team: null,
    ...configOverrides,
  };
  setupMocks();
  return render(<StudentForm config={config} />);
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('StudentForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correct number of member fields', async () => {
    renderForm({ members_per_team: 5 });
    await waitFor(() => {
      const nameInputs = screen.getAllByLabelText(/Full Name/i);
      expect(nameInputs).toHaveLength(5);
      const regInputs = screen.getAllByLabelText(/Registration Number/i);
      expect(regInputs).toHaveLength(5);
    });
  });

  it('shows "Optional" labels when incomplete teams allowed', async () => {
    renderForm({
      members_per_team: 5,
      allow_incomplete_teams: true,
      min_members_per_team: 3,
    });
    await waitFor(() => {
      const optionalLabels = screen.getAllByText('Optional');
      expect(optionalLabels).toHaveLength(2); // members 4 and 5
    });
  });

  it('all fields required when incomplete teams not allowed', async () => {
    renderForm({ members_per_team: 3, allow_incomplete_teams: false });
    await waitFor(() => {
      const requiredIndicators = screen.getAllByText('*');
      // 3 name fields + 3 reg fields + 1 project field = 7 asterisks
      expect(requiredIndicators.length).toBeGreaterThanOrEqual(6);
    });
  });

  it('full projects are disabled in dropdown', async () => {
    renderForm();
    await waitFor(() => {
      const fullOption = screen.getByText('Full Project (Full)');
      expect(fullOption).toBeDisabled();
    });
  });

  it('available projects are selectable', async () => {
    renderForm();
    const user = userEvent.setup();
    await waitFor(() => {
      expect(screen.getByText('Available Project')).toBeInTheDocument();
    });
    const select = screen.getByLabelText(/Select a Project/i);
    await user.selectOptions(select, 'p1');
    expect(select.value).toBe('p1');
  });

  it('shows inline error for duplicate registration number within form', async () => {
    renderForm();
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByText('Available Project')).toBeInTheDocument());

    const nameInputs = screen.getAllByLabelText(/Full Name/i);
    const regInputs = screen.getAllByLabelText(/Registration Number/i);

    await user.type(nameInputs[0], 'Alice');
    await user.type(regInputs[0], 'DUPREG');
    await user.type(nameInputs[1], 'Bob');
    await user.type(regInputs[1], 'DUPREG');
    await user.type(nameInputs[2], 'Carol');
    await user.type(regInputs[2], 'UNIQUE');

    const select = screen.getByLabelText(/Select a Project/i);
    await user.selectOptions(select, 'p1');

    // Use fireEvent.submit to bypass HTML native validation so the JS handler runs
    const form = document.querySelector('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/Duplicate registration number/i)).toBeInTheDocument();
    });
  });

  it('shows error for empty required fields on submit', async () => {
    renderForm();
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByText('Available Project')).toBeInTheDocument());

    // Select project but leave members empty
    const select = screen.getByLabelText(/Select a Project/i);
    await user.selectOptions(select, 'p1');

    // Use fireEvent.submit to bypass HTML native required validation
    const form = document.querySelector('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/Please fill in all required fields/i)).toBeInTheDocument();
    });
  });

  it('submit button disables during submission', async () => {
    // Use a deferred promise so the RPC doesn't resolve immediately
    let resolveRpc;
    mockRpc.mockReturnValue(
      new Promise((resolve) => {
        resolveRpc = resolve;
      })
    );

    renderForm();
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByText('Available Project')).toBeInTheDocument());

    const nameInputs = screen.getAllByLabelText(/Full Name/i);
    const regInputs = screen.getAllByLabelText(/Registration Number/i);
    for (let i = 0; i < 3; i++) {
      await user.type(nameInputs[i], `Person ${i}`);
      await user.type(regInputs[i], `BTNTEST-${i}`);
    }
    const select = screen.getByLabelText(/Select a Project/i);
    await user.selectOptions(select, 'p1');

    // Submit via fireEvent to trigger the handler immediately
    const form = document.querySelector('form');
    fireEvent.submit(form);

    // Button should show loading state while RPC is in-flight
    await waitFor(() => {
      expect(screen.queryByText(/Registering/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Registering/i })).toBeDisabled();
    });

    // Resolve the deferred RPC
    resolveRpc({ data: { success: true, team_number: 99 }, error: null });
  });

  it('shows general error when submission fails', async () => {
    mockRpc.mockResolvedValue({
      data: { success: false, error: 'Some server error' },
      error: null,
    });

    renderForm();
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByText('Available Project')).toBeInTheDocument());

    const nameInputs = screen.getAllByLabelText(/Full Name/i);
    const regInputs = screen.getAllByLabelText(/Registration Number/i);
    for (let i = 0; i < 3; i++) {
      await user.type(nameInputs[i], `Person ${i}`);
      await user.type(regInputs[i], `GENERR-${i}`);
    }
    const select = screen.getByLabelText(/Select a Project/i);
    await user.selectOptions(select, 'p1');

    const form = document.querySelector('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('Some server error')).toBeInTheDocument();
    });
  });

  it('shows field-specific error for server-side duplicate', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: false,
        error: 'Registration number TEST-0001 is already registered.',
        duplicate_field: 'TEST-0001',
      },
      error: null,
    });

    renderForm();
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByText('Available Project')).toBeInTheDocument());

    const nameInputs = screen.getAllByLabelText(/Full Name/i);
    const regInputs = screen.getAllByLabelText(/Registration Number/i);
    await user.type(nameInputs[0], 'Alice');
    await user.type(regInputs[0], 'TEST-0001');
    await user.type(nameInputs[1], 'Bob');
    await user.type(regInputs[1], 'TEST-0002');
    await user.type(nameInputs[2], 'Carol');
    await user.type(regInputs[2], 'TEST-0003');

    const select = screen.getByLabelText(/Select a Project/i);
    await user.selectOptions(select, 'p1');

    const form = document.querySelector('form');
    fireEvent.submit(form);

    await waitFor(() => {
      // The inline field-level error appears next to the duplicate field
      expect(
        screen.getByText('This registration number is already registered.')
      ).toBeInTheDocument();
    });
  });
});
