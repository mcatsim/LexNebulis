import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../../test/test-utils';
import { axe } from 'vitest-axe';
import DashboardPage from '../DashboardPage';
import { useAuthStore } from '../../../stores/authStore';
import { mockUser } from '../../../test/mocks/data';

describe('DashboardPage', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    useAuthStore.getState().setTokens('valid-token', 'valid-refresh');
    useAuthStore.getState().setUser(mockUser);
  });

  it('renders welcome message with user first name', () => {
    render(<DashboardPage />);

    expect(screen.getByText(/welcome back, jane/i)).toBeInTheDocument();
  });

  it('renders all four stat card labels', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Active Clients')).toBeInTheDocument();
      expect(screen.getByText('Open Matters')).toBeInTheDocument();
      // "Upcoming Events" and "Recent Time Entries" appear both as stat labels
      // and as section headings, so use getAllByText
      expect(screen.getAllByText('Upcoming Events').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Recent Time Entries').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('displays stat values after data loads', async () => {
    render(<DashboardPage />);

    // MSW returns 2 clients, 2 matters, 3 events, 3 time entries
    await waitFor(() => {
      // Multiple stat cards may show "2" or "3"; check that at least one exists
      const twos = screen.getAllByText('2');
      expect(twos.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders the Upcoming Events section heading', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      // The section heading is an h2 rendered by Title order={2}
      const headings = screen.getAllByText('Upcoming Events');
      const sectionHeading = headings.find(
        (el) => el.tagName === 'H2',
      );
      expect(sectionHeading).toBeDefined();
    });
  });

  it('displays event titles after data loads', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Summary Judgment Hearing')).toBeInTheDocument();
    });
  });

  it('displays event type badges', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('court_date')).toBeInTheDocument();
    });
  });

  it('renders the Recent Time Entries section heading', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      const headings = screen.getAllByText('Recent Time Entries');
      const sectionHeading = headings.find(
        (el) => el.tagName === 'H2',
      );
      expect(sectionHeading).toBeDefined();
    });
  });

  it('displays time entry descriptions after data loads', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Drafted motion for summary judgment')).toBeInTheDocument();
    });
  });

  it('displays time entry durations', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('120 min')).toBeInTheDocument();
    });
  });

  it('shows fallback text when there are no events', async () => {
    const { server } = await import('../../../test/mocks/server');
    const { http, HttpResponse } = await import('msw');

    server.use(
      http.get('/api/calendar', () => {
        return HttpResponse.json({
          items: [],
          total: 0,
          page: 1,
          page_size: 5,
          total_pages: 1,
        });
      }),
    );

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('No upcoming events')).toBeInTheDocument();
    });
  });

  it('shows fallback text when there are no time entries', async () => {
    const { server } = await import('../../../test/mocks/server');
    const { http, HttpResponse } = await import('msw');

    server.use(
      http.get('/api/billing/time-entries', () => {
        return HttpResponse.json({
          items: [],
          total: 0,
          page: 1,
          page_size: 25,
          total_pages: 1,
        });
      }),
    );

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('No recent time entries')).toBeInTheDocument();
    });
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
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
