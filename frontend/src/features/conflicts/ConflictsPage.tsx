import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconCheck,
  IconCircleCheck,
  IconFlag,
  IconSearch,
  IconShieldLock,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DataTable from '../../components/DataTable';
import { conflictsApi, mattersApi, authApi } from '../../api/services';
import { useAuthStore } from '../../stores/authStore';
import type { ConflictCheck, ConflictMatch, EthicalWall, MatchResolution } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  clear: 'green',
  potential_conflict: 'yellow',
  confirmed_conflict: 'red',
};

const STATUS_LABELS: Record<string, string> = {
  clear: 'Clear',
  potential_conflict: 'Potential Conflict',
  confirmed_conflict: 'Confirmed Conflict',
};

const MATCH_TYPE_COLORS: Record<string, string> = {
  exact: 'red',
  fuzzy: 'yellow',
  phonetic: 'violet',
  email: 'blue',
};

const RESOLUTION_COLORS: Record<string, string> = {
  not_reviewed: 'gray',
  cleared: 'green',
  flagged: 'red',
  waiver_obtained: 'blue',
};

const RESOLUTION_LABELS: Record<string, string> = {
  not_reviewed: 'Not Reviewed',
  cleared: 'Cleared',
  flagged: 'Flagged',
  waiver_obtained: 'Waiver Obtained',
};

// ---------------------------------------------------------------------------
// Conflict Checker Tab
// ---------------------------------------------------------------------------

function ConflictCheckerTab() {
  const queryClient = useQueryClient();
  const [checkPage, setCheckPage] = useState(1);
  const [checkPageSize, setCheckPageSize] = useState(25);
  const [selectedCheck, setSelectedCheck] = useState<ConflictCheck | null>(null);

  const searchForm = useForm({
    initialValues: {
      search_name: '',
      search_organization: '',
      matter_id: '',
    },
    validate: {
      search_name: (v) => (v.trim() ? null : 'Name is required'),
    },
  });

  const { data: mattersData } = useQuery({
    queryKey: ['matters', { page: 1, page_size: 200 }],
    queryFn: () => mattersApi.list({ page: 1, page_size: 200 }),
  });

  const matterOptions = useMemo(
    () => [
      { value: '', label: '(None)' },
      ...(mattersData?.data?.items ?? []).map((m) => ({
        value: m.id,
        label: `${m.matter_number} - ${m.title}`,
      })),
    ],
    [mattersData],
  );

  const { data: checksData, isLoading: checksLoading } = useQuery({
    queryKey: ['conflict-checks', { page: checkPage, page_size: checkPageSize }],
    queryFn: () => conflictsApi.listChecks({ page: checkPage, page_size: checkPageSize }),
  });

  const runCheckMutation = useMutation({
    mutationFn: (data: { search_name: string; search_organization?: string; matter_id?: string }) =>
      conflictsApi.runCheck(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['conflict-checks'] });
      const check = response.data;
      setSelectedCheck(check);
      if (check.status === 'clear') {
        notifications.show({ title: 'All Clear', message: 'No conflicts found', color: 'green' });
      } else {
        notifications.show({
          title: 'Conflicts Found',
          message: `${check.matches?.length ?? 0} potential match(es) found`,
          color: 'orange',
        });
      }
      searchForm.reset();
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to run conflict check', color: 'red' });
    },
  });

  const resolveMatchMutation = useMutation({
    mutationFn: ({ matchId, resolution, notes }: { matchId: string; resolution: string; notes?: string }) =>
      conflictsApi.resolveMatch(matchId, { resolution, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conflict-checks'] });
      // Refetch current check detail
      if (selectedCheck) {
        conflictsApi.getCheck(selectedCheck.id).then((res) => setSelectedCheck(res.data));
      }
      notifications.show({ title: 'Success', message: 'Match resolution updated', color: 'green' });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to resolve match', color: 'red' });
    },
  });

  const handleRunCheck = (values: typeof searchForm.values) => {
    runCheckMutation.mutate({
      search_name: values.search_name,
      search_organization: values.search_organization || undefined,
      matter_id: values.matter_id || undefined,
    });
  };

  const handleResolve = (matchId: string, resolution: MatchResolution) => {
    resolveMatchMutation.mutate({ matchId, resolution });
  };

  const checks = checksData?.data?.items ?? [];
  const checksTotal = checksData?.data?.total ?? 0;

  const checksColumns = [
    {
      key: 'created_at',
      label: 'Date',
      render: (c: ConflictCheck) => new Date(c.created_at).toLocaleString(),
    },
    { key: 'search_name', label: 'Search Name' },
    { key: 'search_organization', label: 'Organization' },
    {
      key: 'status',
      label: 'Status',
      render: (c: ConflictCheck) => (
        <Badge color={STATUS_COLORS[c.status] ?? 'gray'} variant="light" size="sm">
          {STATUS_LABELS[c.status] ?? c.status}
        </Badge>
      ),
    },
    {
      key: 'match_count',
      label: 'Matches',
      render: (c: ConflictCheck) => (c as ConflictCheck & { match_count?: number }).match_count ?? 0,
    },
  ];

  return (
    <Stack>
      {/* Search Form */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <form onSubmit={searchForm.onSubmit(handleRunCheck)}>
          <Stack gap="sm">
            <Title order={4}>Run Conflict Check</Title>
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <TextInput
                label="Name"
                placeholder="Enter person or organization name"
                required
                leftSection={<IconSearch size={16} />}
                {...searchForm.getInputProps('search_name')}
              />
              <TextInput
                label="Organization (optional)"
                placeholder="Organization name"
                {...searchForm.getInputProps('search_organization')}
              />
              <Select
                label="Related Matter (optional)"
                placeholder="Select matter"
                data={matterOptions}
                searchable
                clearable
                {...searchForm.getInputProps('matter_id')}
              />
            </SimpleGrid>
            <Group>
              <Button
                type="submit"
                leftSection={<IconSearch size={16} />}
                loading={runCheckMutation.isPending}
              >
                Run Check
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>

      {/* Results Detail */}
      {selectedCheck && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group justify="space-between">
              <Group>
                <Title order={4}>Check Results</Title>
                <Badge
                  color={STATUS_COLORS[selectedCheck.status] ?? 'gray'}
                  variant="filled"
                  size="lg"
                >
                  {STATUS_LABELS[selectedCheck.status] ?? selectedCheck.status}
                </Badge>
              </Group>
              <Button
                variant="subtle"
                color="gray"
                size="xs"
                onClick={() => setSelectedCheck(null)}
                leftSection={<IconX size={14} />}
              >
                Close
              </Button>
            </Group>

            <Group gap="lg">
              <Text size="sm" c="dimmed">
                Search: <Text span fw={600}>{selectedCheck.search_name}</Text>
              </Text>
              {selectedCheck.search_organization && (
                <Text size="sm" c="dimmed">
                  Org: <Text span fw={600}>{selectedCheck.search_organization}</Text>
                </Text>
              )}
              <Text size="sm" c="dimmed">
                Date: {new Date(selectedCheck.created_at).toLocaleString()}
              </Text>
            </Group>

            {selectedCheck.matches?.length === 0 ? (
              <Card padding="xl" radius="md" bg="green.0">
                <Group justify="center">
                  <IconCircleCheck size={24} color="var(--mantine-color-green-6)" />
                  <Text c="green" fw={600}>No conflicts detected</Text>
                </Group>
              </Card>
            ) : (
              <SimpleGrid cols={{ base: 1, md: 2 }}>
                {selectedCheck.matches?.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    onResolve={handleResolve}
                    isPending={resolveMatchMutation.isPending}
                  />
                ))}
              </SimpleGrid>
            )}
          </Stack>
        </Card>
      )}

      {/* Past Checks Table */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={4} mb="md">Check History</Title>
        <DataTable<ConflictCheck>
          columns={checksColumns}
          data={checks}
          total={checksTotal}
          page={checkPage}
          pageSize={checkPageSize}
          onPageChange={setCheckPage}
          onPageSizeChange={setCheckPageSize}
          onRowClick={(check) => {
            conflictsApi.getCheck(check.id).then((res) => setSelectedCheck(res.data));
          }}
          loading={checksLoading}
        />
      </Card>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Match Card
// ---------------------------------------------------------------------------

function MatchCard({
  match,
  onResolve,
  isPending,
}: {
  match: ConflictMatch;
  onResolve: (matchId: string, resolution: MatchResolution) => void;
  isPending: boolean;
}) {
  const scorePercent = Math.round(match.match_score * 100);

  return (
    <Card shadow="xs" padding="md" radius="md" withBorder>
      <Stack gap="xs">
        <Group justify="space-between">
          <Group gap="xs">
            <Text fw={600} size="sm">{match.matched_name}</Text>
            <Badge color={MATCH_TYPE_COLORS[match.match_type] ?? 'gray'} variant="light" size="xs">
              {match.match_type}
            </Badge>
          </Group>
          <Badge
            color={match.matched_entity_type === 'client' ? 'blue' : match.matched_entity_type === 'contact' ? 'cyan' : 'orange'}
            variant="outline"
            size="xs"
          >
            {match.matched_entity_type}
          </Badge>
        </Group>

        <Group gap="xs" align="center">
          <Text size="xs" c="dimmed" w={80}>
            Score: {scorePercent}%
          </Text>
          <Progress
            value={scorePercent}
            color={scorePercent >= 90 ? 'red' : scorePercent >= 70 ? 'orange' : 'yellow'}
            size="sm"
            style={{ flex: 1 }}
          />
        </Group>

        {match.relationship_context && (
          <Text size="xs" c="dimmed">{match.relationship_context}</Text>
        )}

        <Group justify="space-between" mt="xs">
          <Badge
            color={RESOLUTION_COLORS[match.resolution] ?? 'gray'}
            variant="light"
            size="sm"
          >
            {RESOLUTION_LABELS[match.resolution] ?? match.resolution}
          </Badge>

          {match.resolution === 'not_reviewed' && (
            <Group gap="xs">
              <Tooltip label="Clear - No conflict">
                <ActionIcon
                  color="green"
                  variant="light"
                  size="sm"
                  onClick={() => onResolve(match.id, 'cleared')}
                  loading={isPending}
                >
                  <IconCheck size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Flag - Potential conflict">
                <ActionIcon
                  color="red"
                  variant="light"
                  size="sm"
                  onClick={() => onResolve(match.id, 'flagged')}
                  loading={isPending}
                >
                  <IconFlag size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Waiver Obtained">
                <ActionIcon
                  color="blue"
                  variant="light"
                  size="sm"
                  onClick={() => onResolve(match.id, 'waiver_obtained')}
                  loading={isPending}
                >
                  <IconShieldLock size={14} />
                </ActionIcon>
              </Tooltip>
            </Group>
          )}
        </Group>
      </Stack>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Ethical Walls Tab
// ---------------------------------------------------------------------------

function EthicalWallsTab() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [selectedMatterId, setSelectedMatterId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const wallForm = useForm({
    initialValues: {
      matter_id: '',
      user_id: '',
      reason: '',
    },
    validate: {
      matter_id: (v) => (v ? null : 'Matter is required'),
      user_id: (v) => (v ? null : 'User is required'),
      reason: (v) => (v.trim() ? null : 'Reason is required'),
    },
  });

  const { data: mattersData } = useQuery({
    queryKey: ['matters', { page: 1, page_size: 200 }],
    queryFn: () => mattersApi.list({ page: 1, page_size: 200 }),
  });

  const { data: usersData } = useQuery({
    queryKey: ['users', { page: 1, page_size: 200 }],
    queryFn: () => authApi.listUsers(1, 200),
  });

  const matterOptions = useMemo(
    () =>
      (mattersData?.data?.items ?? []).map((m) => ({
        value: m.id,
        label: `${m.matter_number} - ${m.title}`,
      })),
    [mattersData],
  );

  const matterFilterOptions = useMemo(
    () => [
      { value: '', label: 'All Matters' },
      ...matterOptions,
    ],
    [matterOptions],
  );

  const userOptions = useMemo(
    () =>
      (usersData?.data?.items ?? []).map((u) => ({
        value: u.id,
        label: `${u.first_name} ${u.last_name} (${u.role})`,
      })),
    [usersData],
  );

  const userLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of usersData?.data?.items ?? []) {
      map.set(u.id, `${u.first_name} ${u.last_name}`);
    }
    return map;
  }, [usersData]);

  const matterLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of mattersData?.data?.items ?? []) {
      map.set(m.id, `${m.matter_number} - ${m.title}`);
    }
    return map;
  }, [mattersData]);

  const { data: wallsData, isLoading: wallsLoading } = useQuery({
    queryKey: ['ethical-walls', selectedMatterId],
    queryFn: () => conflictsApi.getWalls(selectedMatterId!),
    enabled: !!selectedMatterId,
  });

  const createWallMutation = useMutation({
    mutationFn: (data: { matter_id: string; user_id: string; reason: string }) =>
      conflictsApi.createWall(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ethical-walls'] });
      notifications.show({ title: 'Success', message: 'Ethical wall created', color: 'green' });
      setCreateModalOpen(false);
      wallForm.reset();
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to create ethical wall', color: 'red' });
    },
  });

  const removeWallMutation = useMutation({
    mutationFn: (wallId: string) => conflictsApi.removeWall(wallId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ethical-walls'] });
      notifications.show({ title: 'Success', message: 'Ethical wall removed', color: 'green' });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to remove ethical wall', color: 'red' });
    },
  });

  const handleCreateWall = (values: typeof wallForm.values) => {
    createWallMutation.mutate(values);
  };

  const walls: EthicalWall[] = Array.isArray(wallsData?.data)
    ? wallsData.data
    : [];

  const wallColumns = [
    {
      key: 'matter_id',
      label: 'Matter',
      render: (w: EthicalWall) => matterLookup.get(w.matter_id) ?? w.matter_id.slice(0, 8),
    },
    {
      key: 'user_id',
      label: 'Walled User',
      render: (w: EthicalWall) => userLookup.get(w.user_id) ?? w.user_id.slice(0, 8),
    },
    { key: 'reason', label: 'Reason' },
    {
      key: 'created_by',
      label: 'Created By',
      render: (w: EthicalWall) => userLookup.get(w.created_by) ?? w.created_by.slice(0, 8),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (w: EthicalWall) => new Date(w.created_at).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: '',
      render: (w: EthicalWall) =>
        user?.role === 'admin' ? (
          <Tooltip label="Remove wall">
            <ActionIcon
              color="red"
              variant="light"
              size="sm"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                removeWallMutation.mutate(w.id);
              }}
              loading={removeWallMutation.isPending}
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        ) : null,
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Select
            placeholder="Select a matter to view walls"
            data={matterFilterOptions}
            searchable
            value={selectedMatterId ?? ''}
            onChange={(v) => setSelectedMatterId(v || null)}
            w={350}
          />
        </Group>
        {user?.role === 'admin' && (
          <Button
            leftSection={<IconShieldLock size={16} />}
            onClick={() => setCreateModalOpen(true)}
          >
            Create Ethical Wall
          </Button>
        )}
      </Group>

      {!selectedMatterId ? (
        <Card shadow="sm" padding="xl" radius="md" withBorder>
          <Text c="dimmed" ta="center">
            Select a matter above to view its ethical walls.
          </Text>
        </Card>
      ) : wallsLoading ? (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      ) : walls.length === 0 ? (
        <Card shadow="sm" padding="xl" radius="md" withBorder>
          <Text c="dimmed" ta="center">
            No ethical walls found for this matter.
          </Text>
        </Card>
      ) : (
        <DataTable<EthicalWall>
          columns={wallColumns}
          data={walls}
          total={walls.length}
          page={1}
          pageSize={100}
          onPageChange={() => {}}
        />
      )}

      {/* Create Ethical Wall Modal */}
      <Modal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Ethical Wall"
        size="md"
      >
        <form onSubmit={wallForm.onSubmit(handleCreateWall)}>
          <Stack>
            <Select
              label="Matter"
              placeholder="Select matter"
              data={matterOptions}
              searchable
              required
              {...wallForm.getInputProps('matter_id')}
            />
            <Select
              label="User to Wall Off"
              placeholder="Select user"
              data={userOptions}
              searchable
              required
              {...wallForm.getInputProps('user_id')}
            />
            <Textarea
              label="Reason"
              placeholder="Explain the reason for the ethical wall"
              required
              minRows={3}
              {...wallForm.getInputProps('reason')}
            />
            <Button
              type="submit"
              loading={createWallMutation.isPending}
              leftSection={<IconShieldLock size={16} />}
            >
              Create Wall
            </Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ConflictsPage() {
  return (
    <Stack>
      <Group>
        <IconAlertTriangle size={28} color="var(--mantine-color-orange-6)" />
        <Title order={2}>Conflict of Interest Checking</Title>
      </Group>

      <Tabs defaultValue="checker">
        <Tabs.List>
          <Tabs.Tab value="checker" leftSection={<IconSearch size={16} />}>
            Conflict Checker
          </Tabs.Tab>
          <Tabs.Tab value="walls" leftSection={<IconShieldLock size={16} />}>
            Ethical Walls
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="checker" pt="md">
          <ConflictCheckerTab />
        </Tabs.Panel>

        <Tabs.Panel value="walls" pt="md">
          <EthicalWallsTab />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
