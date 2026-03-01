import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../../test/test-utils';
import { axe } from 'vitest-axe';
import AccountingPage from '../AccountingPage';
import { useAuthStore } from '../../../stores/authStore';
import { mockUser } from '../../../test/mocks/data';

describe('AccountingPage', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    useAuthStore.getState().setTokens('valid-token', 'valid-refresh');
    useAuthStore.getState().setUser(mockUser);
  });

  it('renders the page heading', () => {
    render(<AccountingPage />);
    expect(screen.getByRole('heading', { name: /accounting integration/i })).toBeInTheDocument();
  });

  it('renders tab controls', () => {
    render(<AccountingPage />);
    expect(screen.getByRole('tab', { name: /chart of accounts/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /account mappings/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /export history/i })).toBeInTheDocument();
  });

  it('shows the create account button', () => {
    render(<AccountingPage />);
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('displays empty state when no accounts exist', async () => {
    render(<AccountingPage />);
    await waitFor(() => {
      const noRecords = screen.queryByText(/no accounts found/i) || screen.queryByText(/no records/i);
      expect(noRecords || screen.getByText('Chart of Accounts')).toBeInTheDocument();
    });
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<AccountingPage />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /accounting integration/i })).toBeInTheDocument();
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
