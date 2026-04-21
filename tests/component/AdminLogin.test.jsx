import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminLogin from '../../src/components/AdminLogin';

// ---------------------------------------------------------------------------
// Mock Supabase
// ---------------------------------------------------------------------------
const mockSignIn = vi.fn();

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args) => mockSignIn(...args),
    },
  },
}));

describe('AdminLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email and password fields', () => {
    render(<AdminLogin />);
    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
  });

  it('shows error on invalid credentials', async () => {
    mockSignIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } });

    render(<AdminLogin />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/email/i), 'bad@test.com');
    await user.type(screen.getByPlaceholderText(/password/i), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/Invalid login credentials/i)).toBeInTheDocument();
    });
  });

  it('calls signInWithPassword on submit with correct values', async () => {
    mockSignIn.mockResolvedValue({ error: null });

    render(<AdminLogin />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/email/i), 'admin@test.com');
    await user.type(screen.getByPlaceholderText(/password/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'admin@test.com',
        password: 'secret123',
      });
    });
  });
});
