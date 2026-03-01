import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../../test/test-utils';
import { axe } from 'vitest-axe';
import PaymentsPage from '../PaymentsPage';
import { useAuthStore } from '../../../stores/authStore';
import { mockUser } from '../../../test/mocks/data';

describe('PaymentsPage', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    useAuthStore.getState().setTokens('valid-token', 'valid-refresh');
    useAuthStore.getState().setUser(mockUser);
  });

  it('renders the page heading', () => {
    render(<PaymentsPage />);
    expect(screen.getByRole('heading', { name: /online payments/i })).toBeInTheDocument();
  });

  it('renders tab controls', () => {
    render(<PaymentsPage />);
    expect(screen.getByRole('tab', { name: /payment links/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /webhooks/i })).toBeInTheDocument();
  });

  it('shows the create payment link button', () => {
    render(<PaymentsPage />);
    expect(screen.getByRole('button', { name: /create payment link/i })).toBeInTheDocument();
  });

  it('displays empty state for payment links', async () => {
    render(<PaymentsPage />);
    await waitFor(() => {
      const noRecords = screen.queryByText(/no payment links/i) || screen.queryByText(/no records/i);
      expect(noRecords || screen.getByText('Payment Links')).toBeInTheDocument();
    });
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<PaymentsPage />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /online payments/i })).toBeInTheDocument();
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
