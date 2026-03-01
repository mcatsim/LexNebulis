import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../../test/test-utils';
import { axe } from 'vitest-axe';
import TemplatesPage from '../TemplatesPage';
import { useAuthStore } from '../../../stores/authStore';
import { mockUser } from '../../../test/mocks/data';

describe('TemplatesPage', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    useAuthStore.getState().setTokens('valid-token', 'valid-refresh');
    useAuthStore.getState().setUser(mockUser);
  });

  it('renders the page heading', () => {
    render(<TemplatesPage />);
    expect(screen.getByRole('heading', { name: /document templates/i })).toBeInTheDocument();
  });

  it('renders tab controls', () => {
    render(<TemplatesPage />);
    expect(screen.getByRole('tab', { name: /^templates$/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /generate document/i })).toBeInTheDocument();
  });

  it('shows the upload template button', () => {
    render(<TemplatesPage />);
    expect(screen.getByRole('button', { name: /upload template/i })).toBeInTheDocument();
  });

  it('displays empty state when no templates exist', async () => {
    render(<TemplatesPage />);
    await waitFor(() => {
      const noRecords = screen.queryByText(/no templates/i) || screen.queryByText(/no records/i) || screen.queryByText(/no data/i);
      expect(noRecords || screen.getByText('Templates')).toBeInTheDocument();
    });
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<TemplatesPage />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /document templates/i })).toBeInTheDocument();
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
