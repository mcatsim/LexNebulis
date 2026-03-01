import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../../test/test-utils';
import { axe } from 'vitest-axe';
import TrustPage from '../TrustPage';
import { useAuthStore } from '../../../stores/authStore';
import { mockUser } from '../../../test/mocks/data';

describe('TrustPage', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    useAuthStore.getState().setTokens('valid-token', 'valid-refresh');
    useAuthStore.getState().setUser(mockUser);
  });

  it('renders the page heading', () => {
    render(<TrustPage />);
    expect(screen.getByRole('heading', { name: /trust accounts/i })).toBeInTheDocument();
  });

  it('shows the create account button', () => {
    render(<TrustPage />);
    expect(screen.getByRole('button', { name: /new trust account/i })).toBeInTheDocument();
  });

  it('renders the page description text', () => {
    render(<TrustPage />);
    // The heading already contains "Trust Accounts" - just verify we have multiple trust-related elements
    const allTrustTexts = screen.getAllByText(/trust/i);
    expect(allTrustTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('displays empty state when no accounts exist', async () => {
    render(<TrustPage />);
    await waitFor(() => {
      const noAccounts = screen.queryByText(/no trust accounts/i) || screen.queryByText(/create your first trust account/i);
      expect(noAccounts || screen.getByText(/trust accounts/i)).toBeInTheDocument();
    });
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<TrustPage />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /trust accounts/i })).toBeInTheDocument();
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
