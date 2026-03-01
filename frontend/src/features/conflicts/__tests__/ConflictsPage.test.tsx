import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../../test/test-utils';
import { axe } from 'vitest-axe';
import ConflictsPage from '../ConflictsPage';
import { useAuthStore } from '../../../stores/authStore';
import { mockUser } from '../../../test/mocks/data';

describe('ConflictsPage', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    useAuthStore.getState().setTokens('valid-token', 'valid-refresh');
    useAuthStore.getState().setUser(mockUser);
  });

  it('renders the page heading', () => {
    render(<ConflictsPage />);
    expect(screen.getByRole('heading', { name: /conflict of interest checking/i })).toBeInTheDocument();
  });

  it('renders tab controls', () => {
    render(<ConflictsPage />);
    expect(screen.getByRole('tab', { name: /conflict checker/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /ethical walls/i })).toBeInTheDocument();
  });

  it('shows the run check button', () => {
    render(<ConflictsPage />);
    expect(screen.getByRole('button', { name: /run check/i })).toBeInTheDocument();
  });

  it('displays the check form', async () => {
    render(<ConflictsPage />);
    await waitFor(() => {
      // The Conflict Checker tab should show the "Run Conflict Check" form heading
      expect(screen.getByText('Run Conflict Check')).toBeInTheDocument();
    });
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<ConflictsPage />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /conflict of interest checking/i })).toBeInTheDocument();
    });
    const results = await axe(container, {
      rules: {
        region: { enabled: false },
        'button-name': { enabled: false },
      },
    });
    expect(results).toHaveNoViolations();
  });
});
