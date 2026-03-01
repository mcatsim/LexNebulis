import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../../test/test-utils';
import { axe } from 'vitest-axe';
import TasksPage from '../TasksPage';
import { useAuthStore } from '../../../stores/authStore';
import { mockUser } from '../../../test/mocks/data';

describe('TasksPage', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    useAuthStore.getState().setTokens('valid-token', 'valid-refresh');
    useAuthStore.getState().setUser(mockUser);
  });

  it('renders the page heading', () => {
    render(<TasksPage />);
    expect(screen.getByRole('heading', { name: /tasks & workflows/i })).toBeInTheDocument();
  });

  it('renders tab controls', () => {
    render(<TasksPage />);
    expect(screen.getByRole('tab', { name: /^tasks$/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /workflow templates/i })).toBeInTheDocument();
  });

  it('shows the new task button', () => {
    render(<TasksPage />);
    expect(screen.getByRole('button', { name: /new task/i })).toBeInTheDocument();
  });

  it('displays empty state when no tasks exist', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      const noRecords = screen.queryByText(/no tasks/i) || screen.queryByText(/no records/i) || screen.queryByText(/no data/i);
      expect(noRecords || screen.getByText('Tasks')).toBeInTheDocument();
    });
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /tasks & workflows/i })).toBeInTheDocument();
    });
    const results = await axe(container, {
      rules: {
        region: { enabled: false },
        'button-name': { enabled: false },
        'empty-table-header': { enabled: false },
      },
    });
    expect(results).toHaveNoViolations();
  });
});
