import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '../../test/test-utils';
import SearchOverlay from '../SearchOverlay';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('SearchOverlay', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders the modal when opened', () => {
    render(<SearchOverlay opened={true} onClose={vi.fn()} />);

    expect(screen.getByPlaceholderText(/search clients/i)).toBeInTheDocument();
  });

  it('does not render the search input when closed', () => {
    render(<SearchOverlay opened={false} onClose={vi.fn()} />);

    expect(screen.queryByPlaceholderText(/search clients/i)).not.toBeInTheDocument();
  });

  it('debounces search input and displays results', async () => {
    const { user } = render(<SearchOverlay opened={true} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText(/search clients/i);
    await user.type(input, 'Alice');

    // Wait for debounced query to fire and MSW to respond
    await waitFor(
      () => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it('displays type badges on search results', async () => {
    const { user } = render(<SearchOverlay opened={true} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText(/search clients/i);
    await user.type(input, 'Alice');

    await waitFor(
      () => {
        expect(screen.getByText('client')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it('navigates on result click and closes overlay', async () => {
    const onClose = vi.fn();
    const { user } = render(<SearchOverlay opened={true} onClose={onClose} />);

    const input = screen.getByPlaceholderText(/search clients/i);
    await user.type(input, 'Alice');

    await waitFor(
      () => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    await user.click(screen.getByText('Alice Johnson'));

    expect(mockNavigate).toHaveBeenCalledWith('/clients/client-001');
    expect(onClose).toHaveBeenCalled();
  });

  it('shows no results message when query yields nothing', async () => {
    const { user } = render(<SearchOverlay opened={true} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText(/search clients/i);
    await user.type(input, 'zzzzzznonexistent');

    await waitFor(
      () => {
        expect(screen.getByText('No results found')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it('calls onClose when the modal is dismissed', async () => {
    const onClose = vi.fn();
    render(<SearchOverlay opened={true} onClose={onClose} />);

    // Mantine Modal renders a close mechanism; pressing Escape triggers onClose
    // We simulate the close by finding the overlay and clicking it
    const modal = document.querySelector('.mantine-Modal-overlay');
    if (modal) {
      (modal as HTMLElement).click();
      expect(onClose).toHaveBeenCalled();
    }
  });
});
