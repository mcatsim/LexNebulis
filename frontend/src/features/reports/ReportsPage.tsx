import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconCash,
  IconChartBar,
  IconDownload,
  IconReceipt,
  IconReportAnalytics,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../api/services';
import type {
  AgedReceivable,
  BillableHoursSummary,
  CollectionReport,
  DashboardSummary,
  MatterProfitability,
  RealizationReport,
  ReportExportType,
  RevenueByAttorney,
  UtilizationReport,
} from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatMoney = (cents: number): string => {
  const dollars = cents / 100;
  return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatHours = (hours: number): string => `${hours.toFixed(1)} hrs`;

const formatPercent = (rate: number): string => `${rate.toFixed(1)}%`;

const toDateStr = (d: Date): string => d.toISOString().slice(0, 10);

function getMonthRange(): [Date, Date] {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return [start, end];
}

type DatePreset = 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'last_year';

function getPresetRange(preset: DatePreset): [Date, Date] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (preset) {
    case 'this_month':
      return [new Date(year, month, 1), new Date(year, month + 1, 0)];
    case 'last_month':
      return [new Date(year, month - 1, 1), new Date(year, month, 0)];
    case 'this_quarter': {
      const qStart = Math.floor(month / 3) * 3;
      return [new Date(year, qStart, 1), new Date(year, qStart + 3, 0)];
    }
    case 'this_year':
      return [new Date(year, 0, 1), new Date(year, 11, 31)];
    case 'last_year':
      return [new Date(year - 1, 0, 1), new Date(year - 1, 11, 31)];
  }
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  title: string;
  value: string;
  subtitle: string;
  color: string;
}

function KpiCard({ title, value, subtitle, color }: KpiCardProps) {
  return (
    <Paper shadow="sm" p="lg" radius="md" withBorder>
      <Text size="sm" c="dimmed" fw={500}>{title}</Text>
      <Text size="xl" fw={700} c={color} mt={4}>{value}</Text>
      <Text size="xs" c="dimmed" mt={4}>{subtitle}</Text>
    </Paper>
  );
}

// ---------------------------------------------------------------------------
// Date Range Controls
// ---------------------------------------------------------------------------

interface DateRangeControlsProps {
  startDate: Date;
  endDate: Date;
  onStartChange: (d: Date) => void;
  onEndChange: (d: Date) => void;
}

function DateRangeControls({ startDate, endDate, onStartChange, onEndChange }: DateRangeControlsProps) {
  const handlePreset = (val: string | null) => {
    if (!val) return;
    const [start, end] = getPresetRange(val as DatePreset);
    onStartChange(start);
    onEndChange(end);
  };

  return (
    <Group>
      <DatePickerInput
        label="Start Date"
        value={startDate}
        onChange={(v) => v && onStartChange(v)}
        w={160}
      />
      <DatePickerInput
        label="End Date"
        value={endDate}
        onChange={(v) => v && onEndChange(v)}
        w={160}
      />
      <Select
        label="Preset"
        placeholder="Quick select"
        data={[
          { value: 'this_month', label: 'This Month' },
          { value: 'last_month', label: 'Last Month' },
          { value: 'this_quarter', label: 'This Quarter' },
          { value: 'this_year', label: 'This Year' },
          { value: 'last_year', label: 'Last Year' },
        ]}
        onChange={handlePreset}
        clearable
        w={160}
      />
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Export Button
// ---------------------------------------------------------------------------

function ExportButton({ reportType, startDate, endDate }: {
  reportType: ReportExportType;
  startDate: string;
  endDate: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const params = reportType === 'aged-receivables'
        ? undefined
        : { start_date: startDate, end_date: endDate };
      const response = await reportsApi.exportCsv(reportType, params);
      const blob = new Blob([response.data as BlobPart], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}-report.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="light"
      leftSection={<IconDownload size={16} />}
      onClick={handleExport}
      loading={loading}
      size="sm"
    >
      Export CSV
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------------------------

function OverviewTab({
  summary,
  utilization,
  agedReceivables,
  summaryLoading,
  utilizationLoading,
  arLoading,
  startDate,
  endDate,
}: {
  summary: DashboardSummary | undefined;
  utilization: UtilizationReport[] | undefined;
  agedReceivables: AgedReceivable[] | undefined;
  summaryLoading: boolean;
  utilizationLoading: boolean;
  arLoading: boolean;
  startDate: string;
  endDate: string;
}) {
  if (summaryLoading) {
    return <Stack align="center" py="xl"><Loader /></Stack>;
  }

  return (
    <Stack gap="lg">
      {summary && (
        <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
          <KpiCard
            title="Open Matters"
            value={String(summary.total_matters_open)}
            subtitle={`${summary.total_matters_closed_period} closed this period`}
            color="blue"
          />
          <KpiCard
            title="Work in Progress"
            value={formatMoney(summary.total_wip_cents)}
            subtitle="Unbilled time value"
            color="blue"
          />
          <KpiCard
            title="Utilization Rate"
            value={formatPercent(summary.utilization_rate)}
            subtitle="Billable / total hours"
            color={summary.utilization_rate >= 70 ? 'green' : summary.utilization_rate >= 50 ? 'orange' : 'red'}
          />
          <KpiCard
            title="Avg Collection Days"
            value={`${summary.average_collection_days.toFixed(0)} days`}
            subtitle="Invoice to payment"
            color="blue"
          />
        </SimpleGrid>
      )}

      <Group justify="space-between">
        <Title order={2}>Utilization by Attorney</Title>
        <ExportButton reportType="utilization" startDate={startDate} endDate={endDate} />
      </Group>
      {utilizationLoading ? (
        <Loader size="sm" />
      ) : (
        <Paper shadow="xs" withBorder>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th scope="col">Attorney</Table.Th>
                <Table.Th scope="col">Total Hours</Table.Th>
                <Table.Th scope="col">Billable</Table.Th>
                <Table.Th scope="col">Non-Billable</Table.Th>
                <Table.Th scope="col">Utilization</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(utilization ?? []).map((row) => (
                <Table.Tr key={row.user_id}>
                  <Table.Td>{row.user_name}</Table.Td>
                  <Table.Td>{formatHours(row.total_hours)}</Table.Td>
                  <Table.Td>{formatHours(row.billable_hours)}</Table.Td>
                  <Table.Td>{formatHours(row.non_billable_hours)}</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Progress
                        value={row.utilization_rate}
                        color={row.utilization_rate >= 70 ? 'green' : row.utilization_rate >= 50 ? 'yellow' : 'red'}
                        size="lg"
                        w={100}
                      />
                      <Text size="sm" fw={500}>{formatPercent(row.utilization_rate)}</Text>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {(utilization ?? []).length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text c="dimmed" ta="center" size="sm">No data for this period</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      <Group justify="space-between">
        <Title order={2}>Aged Receivables</Title>
        <ExportButton reportType="aged-receivables" startDate={startDate} endDate={endDate} />
      </Group>
      {arLoading ? (
        <Loader size="sm" />
      ) : (
        <Paper shadow="xs" withBorder>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th scope="col">Client</Table.Th>
                <Table.Th scope="col">Current (0-30)</Table.Th>
                <Table.Th scope="col">31-60 Days</Table.Th>
                <Table.Th scope="col">61-90 Days</Table.Th>
                <Table.Th scope="col">91-120 Days</Table.Th>
                <Table.Th scope="col">120+ Days</Table.Th>
                <Table.Th scope="col">Total</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(agedReceivables ?? []).map((row) => (
                <Table.Tr key={row.client_id}>
                  <Table.Td fw={500}>{row.client_name}</Table.Td>
                  <Table.Td>{formatMoney(row.current_cents)}</Table.Td>
                  <Table.Td>{row.days_31_60_cents > 0 ? formatMoney(row.days_31_60_cents) : '-'}</Table.Td>
                  <Table.Td>
                    {row.days_61_90_cents > 0 ? (
                      <Text c="orange" size="sm" fw={500}>{formatMoney(row.days_61_90_cents)}</Text>
                    ) : '-'}
                  </Table.Td>
                  <Table.Td>
                    {row.days_91_120_cents > 0 ? (
                      <Text c="red" size="sm" fw={500}>{formatMoney(row.days_91_120_cents)}</Text>
                    ) : '-'}
                  </Table.Td>
                  <Table.Td>
                    {row.over_120_cents > 0 ? (
                      <Text c="red" size="sm" fw={700}>{formatMoney(row.over_120_cents)}</Text>
                    ) : '-'}
                  </Table.Td>
                  <Table.Td fw={700}>{formatMoney(row.total_cents)}</Table.Td>
                </Table.Tr>
              ))}
              {(agedReceivables ?? []).length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={7}>
                    <Text c="dimmed" ta="center" size="sm">No outstanding receivables</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Paper>
      )}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Revenue Tab
// ---------------------------------------------------------------------------

function RevenueTab({
  revenue,
  loading,
  startDate,
  endDate,
}: {
  revenue: RevenueByAttorney[] | undefined;
  loading: boolean;
  startDate: string;
  endDate: string;
}) {
  if (loading) {
    return <Stack align="center" py="xl"><Loader /></Stack>;
  }

  const data = revenue ?? [];
  const maxCollected = Math.max(...data.map((r) => r.collected_cents), 1);

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Revenue by Attorney</Title>
        <ExportButton reportType="revenue" startDate={startDate} endDate={endDate} />
      </Group>

      {data.length > 0 && (
        <Paper shadow="xs" p="md" withBorder>
          <Title order={5} mb="md">Collections Overview</Title>
          <Stack gap="sm">
            {data.map((row) => (
              <Group key={row.user_id} gap="sm">
                <Text size="sm" w={160} fw={500}>{row.user_name}</Text>
                <Progress.Root size="xl" style={{ flex: 1 }}>
                  <Progress.Section
                    value={(row.collected_cents / maxCollected) * 100}
                    color="green"
                  >
                    <Progress.Label>{formatMoney(row.collected_cents)}</Progress.Label>
                  </Progress.Section>
                </Progress.Root>
              </Group>
            ))}
          </Stack>
        </Paper>
      )}

      <Paper shadow="xs" withBorder>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th scope="col">Attorney</Table.Th>
              <Table.Th scope="col">Billed</Table.Th>
              <Table.Th scope="col">Collected</Table.Th>
              <Table.Th scope="col">Hours Worked</Table.Th>
              <Table.Th scope="col">Effective Rate</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.map((row) => (
              <Table.Tr key={row.user_id}>
                <Table.Td fw={500}>{row.user_name}</Table.Td>
                <Table.Td>{formatMoney(row.billed_cents)}</Table.Td>
                <Table.Td>
                  <Text c="green" fw={500} size="sm">{formatMoney(row.collected_cents)}</Text>
                </Table.Td>
                <Table.Td>{formatHours(row.hours_worked)}</Table.Td>
                <Table.Td>{formatMoney(row.effective_rate_cents)}/hr</Table.Td>
              </Table.Tr>
            ))}
            {data.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed" ta="center" size="sm">No revenue data for this period</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Paper>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Matters Tab
// ---------------------------------------------------------------------------

function MattersTab({
  profitability,
  loading,
  startDate,
  endDate,
}: {
  profitability: MatterProfitability[] | undefined;
  loading: boolean;
  startDate: string;
  endDate: string;
}) {
  const [sortField, setSortField] = useState<keyof MatterProfitability>('total_collected_cents');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    const data = [...(profitability ?? [])];
    data.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
    return data;
  }, [profitability, sortField, sortDir]);

  const handleSort = (field: keyof MatterProfitability) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortIndicator = (field: keyof MatterProfitability) => {
    if (sortField !== field) return '';
    return sortDir === 'asc' ? ' ^' : ' v';
  };

  if (loading) {
    return <Stack align="center" py="xl"><Loader /></Stack>;
  }

  const STATUS_COLORS: Record<string, string> = {
    open: 'blue',
    pending: 'yellow',
    closed: 'gray',
    archived: 'dark',
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Matter Profitability</Title>
        <ExportButton reportType="matter-profitability" startDate={startDate} endDate={endDate} />
      </Group>

      <Paper shadow="xs" withBorder>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th scope="col" style={{ cursor: 'pointer' }} onClick={() => handleSort('matter_title')}>
                Matter{sortIndicator('matter_title')}
              </Table.Th>
              <Table.Th scope="col">Client</Table.Th>
              <Table.Th scope="col">Status</Table.Th>
              <Table.Th scope="col" style={{ cursor: 'pointer' }} onClick={() => handleSort('total_hours')}>
                Hours{sortIndicator('total_hours')}
              </Table.Th>
              <Table.Th scope="col" style={{ cursor: 'pointer' }} onClick={() => handleSort('total_billed_cents')}>
                Billed{sortIndicator('total_billed_cents')}
              </Table.Th>
              <Table.Th scope="col" style={{ cursor: 'pointer' }} onClick={() => handleSort('total_collected_cents')}>
                Collected{sortIndicator('total_collected_cents')}
              </Table.Th>
              <Table.Th scope="col" style={{ cursor: 'pointer' }} onClick={() => handleSort('effective_rate_cents')}>
                Eff. Rate{sortIndicator('effective_rate_cents')}
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sorted.map((row) => (
              <Table.Tr key={row.matter_id}>
                <Table.Td fw={500}>{row.matter_title}</Table.Td>
                <Table.Td>{row.client_name}</Table.Td>
                <Table.Td>
                  <Badge color={STATUS_COLORS[row.status] ?? 'gray'} variant="light" size="sm">
                    {row.status}
                  </Badge>
                </Table.Td>
                <Table.Td>{formatHours(row.total_hours)}</Table.Td>
                <Table.Td>{formatMoney(row.total_billed_cents)}</Table.Td>
                <Table.Td>
                  <Text c="green" fw={500} size="sm">{formatMoney(row.total_collected_cents)}</Text>
                </Table.Td>
                <Table.Td>{row.effective_rate_cents > 0 ? `${formatMoney(row.effective_rate_cents)}/hr` : '-'}</Table.Td>
              </Table.Tr>
            ))}
            {sorted.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={7}>
                  <Text c="dimmed" ta="center" size="sm">No matter data for this period</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Paper>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Billing Tab
// ---------------------------------------------------------------------------

function BillingTab({
  collection,
  realization,
  billableHours,
  collectionLoading,
  realizationLoading,
  billableLoading,
  startDate,
  endDate,
}: {
  collection: CollectionReport | undefined;
  realization: RealizationReport | undefined;
  billableHours: BillableHoursSummary[] | undefined;
  collectionLoading: boolean;
  realizationLoading: boolean;
  billableLoading: boolean;
  startDate: string;
  endDate: string;
}) {
  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Paper shadow="sm" p="lg" radius="md" withBorder>
          <Title order={5} mb="md">Collection Report</Title>
          {collectionLoading ? (
            <Loader size="sm" />
          ) : collection ? (
            <Stack gap="sm">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Total Invoiced</Text>
                <Text fw={600}>{formatMoney(collection.total_invoiced_cents)}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Total Collected</Text>
                <Text fw={600} c="green">{formatMoney(collection.total_collected_cents)}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Outstanding</Text>
                <Text fw={600} c="orange">{formatMoney(collection.total_outstanding_cents)}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Collection Rate</Text>
                <Badge
                  color={collection.collection_rate >= 80 ? 'green' : collection.collection_rate >= 60 ? 'yellow' : 'red'}
                  variant="filled"
                  size="lg"
                >
                  {formatPercent(collection.collection_rate)}
                </Badge>
              </Group>
            </Stack>
          ) : (
            <Text c="dimmed" size="sm">No data</Text>
          )}
        </Paper>

        <Paper shadow="sm" p="lg" radius="md" withBorder>
          <Title order={5} mb="md">Realization Report</Title>
          {realizationLoading ? (
            <Loader size="sm" />
          ) : realization ? (
            <Stack gap="sm">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Total Billed</Text>
                <Text fw={600}>{formatMoney(realization.total_billed_cents)}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Total Collected</Text>
                <Text fw={600} c="green">{formatMoney(realization.total_collected_cents)}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Realization Rate</Text>
                <Badge
                  color={realization.realization_rate >= 90 ? 'green' : realization.realization_rate >= 70 ? 'yellow' : 'red'}
                  variant="filled"
                  size="lg"
                >
                  {formatPercent(realization.realization_rate)}
                </Badge>
              </Group>
            </Stack>
          ) : (
            <Text c="dimmed" size="sm">No data</Text>
          )}
        </Paper>
      </SimpleGrid>

      <Group justify="space-between">
        <Title order={2}>Billable Hours by Practice Area</Title>
        <ExportButton reportType="billable-hours" startDate={startDate} endDate={endDate} />
      </Group>
      {billableLoading ? (
        <Loader size="sm" />
      ) : (
        <Paper shadow="xs" withBorder>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th scope="col">Attorney</Table.Th>
                <Table.Th scope="col">Practice Area</Table.Th>
                <Table.Th scope="col">Billable Hours</Table.Th>
                <Table.Th scope="col">Billable Amount</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(billableHours ?? []).map((row, idx) => (
                <Table.Tr key={`${row.user_id}-${row.practice_area}-${idx}`}>
                  <Table.Td fw={500}>{row.user_name}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" size="sm">
                      {row.practice_area.replace(/_/g, ' ')}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{formatHours(row.billable_hours)}</Table.Td>
                  <Table.Td>{formatMoney(row.billable_amount_cents)}</Table.Td>
                </Table.Tr>
              ))}
              {(billableHours ?? []).length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={4}>
                    <Text c="dimmed" ta="center" size="sm">No billable hours data for this period</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Paper>
      )}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Main Reports Page
// ---------------------------------------------------------------------------

export default function ReportsPage() {
  const [defaultStart, defaultEnd] = getMonthRange();
  const [startDate, setStartDate] = useState<Date>(defaultStart);
  const [endDate, setEndDate] = useState<Date>(defaultEnd);

  const dateParams = useMemo(
    () => ({
      start_date: toDateStr(startDate),
      end_date: toDateStr(endDate),
    }),
    [startDate, endDate],
  );

  // Queries
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['reports-summary', dateParams],
    queryFn: () => reportsApi.getSummary(dateParams),
  });

  const { data: utilizationData, isLoading: utilizationLoading } = useQuery({
    queryKey: ['reports-utilization', dateParams],
    queryFn: () => reportsApi.getUtilization(dateParams),
  });

  const { data: arData, isLoading: arLoading } = useQuery({
    queryKey: ['reports-aged-receivables'],
    queryFn: () => reportsApi.getAgedReceivables(),
  });

  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ['reports-revenue', dateParams],
    queryFn: () => reportsApi.getRevenueByAttorney(dateParams),
  });

  const { data: profitabilityData, isLoading: profitabilityLoading } = useQuery({
    queryKey: ['reports-profitability', dateParams],
    queryFn: () => reportsApi.getMatterProfitability(dateParams),
  });

  const { data: collectionData, isLoading: collectionLoading } = useQuery({
    queryKey: ['reports-collection', dateParams],
    queryFn: () => reportsApi.getCollection(dateParams),
  });

  const { data: realizationData, isLoading: realizationLoading } = useQuery({
    queryKey: ['reports-realization', dateParams],
    queryFn: () => reportsApi.getRealization(dateParams),
  });

  const { data: billableData, isLoading: billableLoading } = useQuery({
    queryKey: ['reports-billable', dateParams],
    queryFn: () => reportsApi.getBillableHours(dateParams),
  });

  const summary = summaryData?.data;
  const collectionRate = summary?.collection_rate ?? 0;

  return (
    <Stack>
      <Group justify="space-between" align="flex-end">
        <Title order={1}>Reports &amp; Analytics</Title>
        <DateRangeControls
          startDate={startDate}
          endDate={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
        />
      </Group>

      {/* KPI Cards */}
      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
        <KpiCard
          title="Total Revenue"
          value={summary ? formatMoney(summary.total_revenue_cents) : '--'}
          subtitle="Payments received this period"
          color="green"
        />
        <KpiCard
          title="Outstanding AR"
          value={summary ? formatMoney(summary.total_outstanding_cents) : '--'}
          subtitle="Unpaid invoices"
          color="orange"
        />
        <KpiCard
          title="Work in Progress"
          value={summary ? formatMoney(summary.total_wip_cents) : '--'}
          subtitle="Unbilled time value"
          color="blue"
        />
        <KpiCard
          title="Collection Rate"
          value={summary ? formatPercent(collectionRate) : '--'}
          subtitle="Collected / invoiced"
          color={collectionRate >= 80 ? 'green' : collectionRate >= 60 ? 'orange' : 'red'}
        />
      </SimpleGrid>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <Tabs.List>
          <Tabs.Tab value="overview" leftSection={<IconReportAnalytics size={16} />}>
            Overview
          </Tabs.Tab>
          <Tabs.Tab value="revenue" leftSection={<IconCash size={16} />}>
            Revenue
          </Tabs.Tab>
          <Tabs.Tab value="matters" leftSection={<IconChartBar size={16} />}>
            Matters
          </Tabs.Tab>
          <Tabs.Tab value="billing" leftSection={<IconReceipt size={16} />}>
            Billing
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="md">
          <OverviewTab
            summary={summary}
            utilization={utilizationData?.data}
            agedReceivables={arData?.data}
            summaryLoading={summaryLoading}
            utilizationLoading={utilizationLoading}
            arLoading={arLoading}
            startDate={dateParams.start_date}
            endDate={dateParams.end_date}
          />
        </Tabs.Panel>

        <Tabs.Panel value="revenue" pt="md">
          <RevenueTab
            revenue={revenueData?.data}
            loading={revenueLoading}
            startDate={dateParams.start_date}
            endDate={dateParams.end_date}
          />
        </Tabs.Panel>

        <Tabs.Panel value="matters" pt="md">
          <MattersTab
            profitability={profitabilityData?.data}
            loading={profitabilityLoading}
            startDate={dateParams.start_date}
            endDate={dateParams.end_date}
          />
        </Tabs.Panel>

        <Tabs.Panel value="billing" pt="md">
          <BillingTab
            collection={collectionData?.data}
            realization={realizationData?.data}
            billableHours={billableData?.data}
            collectionLoading={collectionLoading}
            realizationLoading={realizationLoading}
            billableLoading={billableLoading}
            startDate={dateParams.start_date}
            endDate={dateParams.end_date}
          />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
