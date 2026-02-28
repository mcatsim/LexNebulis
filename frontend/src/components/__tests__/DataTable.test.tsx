import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../test/test-utils';

import DataTable from '../DataTable';

interface Row {
  id: string;
  name: string;
  email: string;
}

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
];

const sampleData: Row[] = [
  { id: '1', name: 'Alice Johnson', email: 'alice@example.com' },
  { id: '2', name: 'Bob Smith', email: 'bob@example.com' },
  { id: '3', name: 'Carol White', email: 'carol@example.com' },
];

const defaultProps = {
  columns,
  data: sampleData,
  total: 3,
  page: 1,
  pageSize: 25,
  onPageChange: vi.fn(),
};

describe('DataTable', () => {
  it('renders table headers', () => {
    render(<DataTable {...defaultProps} />);

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('renders data rows', () => {
    render(<DataTable {...defaultProps} />);

    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('Bob Smith')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    expect(screen.getByText('Carol White')).toBeInTheDocument();
    expect(screen.getByText('carol@example.com')).toBeInTheDocument();
  });

  it('shows loading text when loading and data is empty', () => {
    render(<DataTable {...defaultProps} data={[]} total={0} loading={true} />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows empty state when no data and not loading', () => {
    render(<DataTable {...defaultProps} data={[]} total={0} loading={false} />);

    expect(screen.getByText('No records found')).toBeInTheDocument();
  });

  it('displays total record count', () => {
    render(<DataTable {...defaultProps} />);

    expect(screen.getByText('3 total records')).toBeInTheDocument();
  });

  it('calls onPageChange when pagination is used', async () => {
    const onPageChange = vi.fn();
    // Multiple pages to ensure pagination buttons appear
    const { user } = render(
      <DataTable
        {...defaultProps}
        total={100}
        page={1}
        pageSize={25}
        onPageChange={onPageChange}
      />,
    );

    // Mantine Pagination renders page buttons; click page 2
    const page2 = screen.getByRole('button', { name: '2' });
    await user.click(page2);

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onRowClick when a row is clicked', async () => {
    const onRowClick = vi.fn();
    const { user } = render(
      <DataTable {...defaultProps} onRowClick={onRowClick} />,
    );

    await user.click(screen.getByText('Alice Johnson'));

    expect(onRowClick).toHaveBeenCalledWith(sampleData[0]);
  });

  it('renders rows with cursor pointer when onRowClick is provided', () => {
    const onRowClick = vi.fn();
    render(<DataTable {...defaultProps} onRowClick={onRowClick} />);

    const row = screen.getByText('Alice Johnson').closest('tr');
    expect(row).toHaveStyle({ cursor: 'pointer' });
  });

  it('renders custom cell content via column render function', () => {
    const customColumns = [
      {
        key: 'name',
        label: 'Name',
        render: (item: Row) => `Custom: ${item.name}`,
      },
      { key: 'email', label: 'Email' },
    ];

    render(<DataTable {...defaultProps} columns={customColumns} />);

    expect(screen.getByText('Custom: Alice Johnson')).toBeInTheDocument();
  });

  it('renders page size selector when onPageSizeChange is provided', () => {
    const onPageSizeChange = vi.fn();
    render(
      <DataTable {...defaultProps} onPageSizeChange={onPageSizeChange} />,
    );

    // Mantine Select renders an input with the current value
    const selects = screen.getAllByDisplayValue('25');
    expect(selects.length).toBeGreaterThanOrEqual(1);
  });

  it('does not render page size selector when onPageSizeChange is absent', () => {
    render(<DataTable {...defaultProps} />);

    // Without the page size handler, there should be no select with value "25"
    expect(screen.queryByDisplayValue('25')).not.toBeInTheDocument();
  });
});
