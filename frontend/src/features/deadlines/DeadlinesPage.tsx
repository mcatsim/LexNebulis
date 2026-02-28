import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Collapse,
  Divider,
  Group,
  Modal,
  MultiSelect,
  NumberInput,
  Paper,
  Progress,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Timeline,
  Title,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconAlarm,
  IconAlertTriangle,
  IconCalendar,
  IconChevronDown,
  IconChevronRight,
  IconGavel,
  IconPlus,
  IconScale,
  IconSeeding,
  IconTrash,
  IconEdit,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deadlinesApi, mattersApi } from '../../api/services';
import type {
  CourtRuleSet,
  DeadlineRule,
  GeneratedDeadline,
  Matter,
  OffsetType,
  StatuteOfLimitations,
  TriggerEvent,
} from '../../types';
import { useAuthStore } from '../../stores/authStore';

// ---------------------------------------------------------------------------
// Common trigger event options
// ---------------------------------------------------------------------------

const TRIGGER_EVENT_OPTIONS = [
  { value: 'complaint_served', label: 'Complaint Served' },
  { value: 'counterclaim_served', label: 'Counterclaim Served' },
  { value: 'motion_filed', label: 'Motion Filed' },
  { value: 'response_to_motion_filed', label: 'Response to Motion Filed' },
  { value: 'frcp_26f_conference', label: 'FRCP 26(f) Conference' },
  { value: 'trial_date', label: 'Trial Date' },
  { value: 'judgment_entered', label: 'Judgment Entered' },
  { value: 'discovery_cutoff', label: 'Discovery Cutoff' },
];

const OFFSET_TYPE_OPTIONS = [
  { value: 'calendar_days', label: 'Calendar Days' },
  { value: 'business_days', label: 'Business Days' },
];

const REMINDER_DAY_OPTIONS = [
  { value: '1', label: '1 day' },
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
  { value: '180', label: '180 days' },
  { value: '365', label: '365 days' },
];

function getUrgencyColor(daysRemaining: number): string {
  if (daysRemaining < 30) return 'red';
  if (daysRemaining < 90) return 'orange';
  if (daysRemaining < 180) return 'yellow';
  return 'green';
}

function formatTriggerName(name: string): string {
  return name
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ---------------------------------------------------------------------------
// Court Rules Tab
// ---------------------------------------------------------------------------

function CourtRulesTab() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [createRuleSetOpen, setCreateRuleSetOpen] = useState(false);
  const [addRuleOpen, setAddRuleOpen] = useState(false);
  const [activeRuleSetId, setActiveRuleSetId] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<DeadlineRule | null>(null);
  const [jurisdictionFilter, setJurisdictionFilter] = useState('');

  const { data: ruleSetsData, isLoading } = useQuery({
    queryKey: ['rule-sets', jurisdictionFilter],
    queryFn: () =>
      deadlinesApi.listRuleSets({
        jurisdiction: jurisdictionFilter || undefined,
      }),
  });

  const ruleSets: CourtRuleSet[] = ruleSetsData?.data ?? [];

  const ruleSetForm = useForm({
    initialValues: { name: '', jurisdiction: '', court_type: '' },
    validate: {
      name: (v) => (v.trim() ? null : 'Name is required'),
      jurisdiction: (v) => (v.trim() ? null : 'Jurisdiction is required'),
    },
  });

  const ruleForm = useForm({
    initialValues: {
      name: '',
      trigger_event: '',
      offset_days: 0,
      offset_type: 'calendar_days',
      description: '',
      creates_event_type: 'deadline',
    },
    validate: {
      name: (v) => (v.trim() ? null : 'Name is required'),
      trigger_event: (v) => (v.trim() ? null : 'Trigger event is required'),
    },
  });

  const createRuleSetMutation = useMutation({
    mutationFn: (data: { name: string; jurisdiction: string; court_type?: string }) =>
      deadlinesApi.createRuleSet(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rule-sets'] });
      notifications.show({ title: 'Success', message: 'Rule set created', color: 'green' });
      setCreateRuleSetOpen(false);
      ruleSetForm.reset();
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to create rule set', color: 'red' });
    },
  });

  const seedFederalMutation = useMutation({
    mutationFn: () => deadlinesApi.seedFederal(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rule-sets'] });
      notifications.show({
        title: 'Success',
        message: 'Federal Rules of Civil Procedure seeded successfully',
        color: 'green',
      });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to seed federal rules', color: 'red' });
    },
  });

  const addRuleMutation = useMutation({
    mutationFn: ({ ruleSetId, data }: { ruleSetId: string; data: { name: string; trigger_event: string; offset_days: number; offset_type: string; description?: string; creates_event_type?: string } }) =>
      deadlinesApi.addRule(ruleSetId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rule-sets'] });
      notifications.show({ title: 'Success', message: 'Rule added', color: 'green' });
      setAddRuleOpen(false);
      ruleForm.reset();
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to add rule', color: 'red' });
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: ({ ruleId, data }: { ruleId: string; data: Partial<DeadlineRule> }) =>
      deadlinesApi.updateRule(ruleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rule-sets'] });
      notifications.show({ title: 'Success', message: 'Rule updated', color: 'green' });
      setEditingRule(null);
      ruleForm.reset();
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to update rule', color: 'red' });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (ruleId: string) => deadlinesApi.deleteRule(ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rule-sets'] });
      notifications.show({ title: 'Success', message: 'Rule deleted', color: 'green' });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to delete rule', color: 'red' });
    },
  });

  const handleCreateRuleSet = (values: typeof ruleSetForm.values) => {
    createRuleSetMutation.mutate({
      name: values.name,
      jurisdiction: values.jurisdiction,
      court_type: values.court_type || undefined,
    });
  };

  const handleAddRule = (values: typeof ruleForm.values) => {
    if (!activeRuleSetId) return;
    addRuleMutation.mutate({
      ruleSetId: activeRuleSetId,
      data: {
        name: values.name,
        trigger_event: values.trigger_event,
        offset_days: values.offset_days,
        offset_type: values.offset_type,
        description: values.description || undefined,
        creates_event_type: values.creates_event_type || 'deadline',
      },
    });
  };

  const handleEditRule = (values: typeof ruleForm.values) => {
    if (!editingRule) return;
    updateRuleMutation.mutate({
      ruleId: editingRule.id,
      data: {
        name: values.name,
        trigger_event: values.trigger_event,
        offset_days: values.offset_days,
        offset_type: values.offset_type as OffsetType,
        description: values.description || undefined,
        creates_event_type: values.creates_event_type || 'deadline',
      },
    });
  };

  const openEditRule = (rule: DeadlineRule) => {
    ruleForm.setValues({
      name: rule.name,
      trigger_event: rule.trigger_event,
      offset_days: rule.offset_days,
      offset_type: rule.offset_type,
      description: rule.description || '',
      creates_event_type: rule.creates_event_type || 'deadline',
    });
    setEditingRule(rule);
  };

  const ruleFormFields = (
    <Stack>
      <TextInput label="Rule Name" required placeholder="e.g. Answer to Complaint" {...ruleForm.getInputProps('name')} />
      <Select
        label="Trigger Event"
        required
        data={TRIGGER_EVENT_OPTIONS}
        searchable
        {...ruleForm.getInputProps('trigger_event')}
      />
      <NumberInput
        label="Offset Days"
        description="Positive = after trigger, negative = before trigger"
        required
        {...ruleForm.getInputProps('offset_days')}
      />
      <Select
        label="Offset Type"
        data={OFFSET_TYPE_OPTIONS}
        {...ruleForm.getInputProps('offset_type')}
      />
      <Textarea label="Description" placeholder="Optional" {...ruleForm.getInputProps('description')} />
    </Stack>
  );

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <TextInput
            placeholder="Filter by jurisdiction..."
            value={jurisdictionFilter}
            onChange={(e) => setJurisdictionFilter(e.currentTarget.value)}
            style={{ width: 250 }}
          />
        </Group>
        <Group>
          {user?.role === 'admin' && (
            <Button
              variant="light"
              color="teal"
              leftSection={<IconSeeding size={16} />}
              onClick={() => seedFederalMutation.mutate()}
              loading={seedFederalMutation.isPending}
            >
              Seed Federal Rules
            </Button>
          )}
          <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateRuleSetOpen(true)}>
            New Rule Set
          </Button>
        </Group>
      </Group>

      {isLoading ? (
        <Text c="dimmed">Loading rule sets...</Text>
      ) : ruleSets.length === 0 ? (
        <Paper p="xl" withBorder>
          <Text c="dimmed" ta="center">
            No court rule sets found. Create one or seed the Federal Rules to get started.
          </Text>
        </Paper>
      ) : (
        <Stack gap="xs">
          {ruleSets.map((rs) => (
            <Card key={rs.id} withBorder padding="sm">
              <Group
                justify="space-between"
                style={{ cursor: 'pointer' }}
                onClick={() => setExpandedId(expandedId === rs.id ? null : rs.id)}
              >
                <Group>
                  {expandedId === rs.id ? (
                    <IconChevronDown size={16} />
                  ) : (
                    <IconChevronRight size={16} />
                  )}
                  <div>
                    <Text fw={600}>{rs.name}</Text>
                    <Text size="xs" c="dimmed">
                      {rs.jurisdiction}
                      {rs.court_type ? ` - ${rs.court_type}` : ''}
                    </Text>
                  </div>
                </Group>
                <Badge variant="light">
                  {rs.rules?.length ?? 0} rule{(rs.rules?.length ?? 0) !== 1 ? 's' : ''}
                </Badge>
              </Group>

              <Collapse in={expandedId === rs.id}>
                <Divider my="sm" />
                <Group justify="flex-end" mb="xs">
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconPlus size={14} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveRuleSetId(rs.id);
                      ruleForm.reset();
                      setAddRuleOpen(true);
                    }}
                  >
                    Add Rule
                  </Button>
                </Group>

                {rs.rules && rs.rules.length > 0 ? (
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Rule Name</Table.Th>
                        <Table.Th>Trigger</Table.Th>
                        <Table.Th>Offset</Table.Th>
                        <Table.Th>Type</Table.Th>
                        <Table.Th style={{ width: 100 }}>Actions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {rs.rules.map((rule) => (
                        <Table.Tr key={rule.id}>
                          <Table.Td>
                            <Text size="sm" fw={500}>{rule.name}</Text>
                            {rule.description && (
                              <Text size="xs" c="dimmed">{rule.description}</Text>
                            )}
                          </Table.Td>
                          <Table.Td>
                            <Badge variant="dot" size="sm">
                              {formatTriggerName(rule.trigger_event)}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">
                              {rule.offset_days > 0 ? '+' : ''}
                              {rule.offset_days} {rule.offset_type === 'business_days' ? 'bus.' : 'cal.'} days
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge size="sm" variant="light">
                              {rule.creates_event_type}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Group gap={4}>
                              <Tooltip label="Edit">
                                <ActionIcon
                                  size="sm"
                                  variant="subtle"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditRule(rule);
                                  }}
                                >
                                  <IconEdit size={14} />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Delete">
                                <ActionIcon
                                  size="sm"
                                  variant="subtle"
                                  color="red"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteRuleMutation.mutate(rule.id);
                                  }}
                                >
                                  <IconTrash size={14} />
                                </ActionIcon>
                              </Tooltip>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                ) : (
                  <Text size="sm" c="dimmed" ta="center" py="sm">
                    No rules defined. Add rules to this set.
                  </Text>
                )}
              </Collapse>
            </Card>
          ))}
        </Stack>
      )}

      {/* Create Rule Set Modal */}
      <Modal
        opened={createRuleSetOpen}
        onClose={() => {
          setCreateRuleSetOpen(false);
          ruleSetForm.reset();
        }}
        title="Create Court Rule Set"
      >
        <form onSubmit={ruleSetForm.onSubmit(handleCreateRuleSet)}>
          <Stack>
            <TextInput label="Name" required placeholder="e.g. Federal Rules of Civil Procedure" {...ruleSetForm.getInputProps('name')} />
            <TextInput label="Jurisdiction" required placeholder="e.g. Federal, California, New York" {...ruleSetForm.getInputProps('jurisdiction')} />
            <TextInput label="Court Type" placeholder="e.g. District, Superior, Circuit" {...ruleSetForm.getInputProps('court_type')} />
            <Button type="submit" fullWidth loading={createRuleSetMutation.isPending}>
              Create Rule Set
            </Button>
          </Stack>
        </form>
      </Modal>

      {/* Add Rule Modal */}
      <Modal
        opened={addRuleOpen}
        onClose={() => {
          setAddRuleOpen(false);
          ruleForm.reset();
        }}
        title="Add Deadline Rule"
      >
        <form onSubmit={ruleForm.onSubmit(handleAddRule)}>
          {ruleFormFields}
          <Button type="submit" mt="md" fullWidth loading={addRuleMutation.isPending}>
            Add Rule
          </Button>
        </form>
      </Modal>

      {/* Edit Rule Modal */}
      <Modal
        opened={editingRule !== null}
        onClose={() => {
          setEditingRule(null);
          ruleForm.reset();
        }}
        title="Edit Deadline Rule"
      >
        <form onSubmit={ruleForm.onSubmit(handleEditRule)}>
          {ruleFormFields}
          <Button type="submit" mt="md" fullWidth loading={updateRuleMutation.isPending}>
            Save Changes
          </Button>
        </form>
      </Modal>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Matter Deadlines Tab
// ---------------------------------------------------------------------------

function MatterDeadlinesTab() {
  const queryClient = useQueryClient();
  const [selectedMatterId, setSelectedMatterId] = useState<string | null>(null);
  const [triggerModalOpen, setTriggerModalOpen] = useState(false);
  const [applyRuleSetOpen, setApplyRuleSetOpen] = useState(false);

  const { data: mattersData } = useQuery({
    queryKey: ['matters', { page: 1, page_size: 200 }],
    queryFn: () => mattersApi.list({ page: 1, page_size: 200 }),
  });

  const matterOptions = useMemo(
    () =>
      (mattersData?.data?.items ?? []).map((m: Matter) => ({
        value: m.id,
        label: `#${m.matter_number} - ${m.title}`,
      })),
    [mattersData],
  );

  const { data: ruleSetsData } = useQuery({
    queryKey: ['rule-sets'],
    queryFn: () => deadlinesApi.listRuleSets(),
  });

  const ruleSetOptions = useMemo(
    () =>
      (ruleSetsData?.data ?? []).map((rs: CourtRuleSet) => ({
        value: rs.id,
        label: `${rs.name} (${rs.jurisdiction})`,
      })),
    [ruleSetsData],
  );

  const { data: triggersData } = useQuery({
    queryKey: ['triggers', selectedMatterId],
    queryFn: () => deadlinesApi.getTriggers(selectedMatterId!),
    enabled: !!selectedMatterId,
  });

  const triggers: TriggerEvent[] = triggersData?.data ?? [];

  const { data: deadlinesData } = useQuery({
    queryKey: ['matter-deadlines', selectedMatterId],
    queryFn: () => deadlinesApi.getMatterDeadlines(selectedMatterId!),
    enabled: !!selectedMatterId,
  });

  const [selectedRuleSetId, setSelectedRuleSetId] = useState<string | null>(null);

  const triggerForm = useForm({
    initialValues: { trigger_name: '', trigger_date: '', notes: '' },
    validate: {
      trigger_name: (v) => (v.trim() ? null : 'Trigger event is required'),
      trigger_date: (v) => (v ? null : 'Date is required'),
    },
  });

  const applyRulesMutation = useMutation({
    mutationFn: ({ matterId, ruleSetId }: { matterId: string; ruleSetId: string }) =>
      deadlinesApi.applyRules(matterId, { rule_set_id: ruleSetId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['triggers'] });
      queryClient.invalidateQueries({ queryKey: ['matter-deadlines'] });
      notifications.show({ title: 'Success', message: 'Rule set applied to matter', color: 'green' });
      setApplyRuleSetOpen(false);
      setSelectedRuleSetId(null);
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to apply rule set', color: 'red' });
    },
  });

  const setTriggerMutation = useMutation({
    mutationFn: ({
      matterId,
      data,
    }: {
      matterId: string;
      data: { trigger_name: string; trigger_date: string; notes?: string };
    }) => deadlinesApi.setTrigger(matterId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['triggers'] });
      queryClient.invalidateQueries({ queryKey: ['matter-deadlines'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      notifications.show({
        title: 'Success',
        message: 'Trigger event set and deadlines generated',
        color: 'green',
      });
      setTriggerModalOpen(false);
      triggerForm.reset();
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to set trigger event', color: 'red' });
    },
  });

  const deleteTriggerMutation = useMutation({
    mutationFn: (triggerId: string) => deadlinesApi.deleteTrigger(triggerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['triggers'] });
      queryClient.invalidateQueries({ queryKey: ['matter-deadlines'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      notifications.show({ title: 'Success', message: 'Trigger and its deadlines removed', color: 'green' });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to delete trigger', color: 'red' });
    },
  });

  const handleSetTrigger = (values: typeof triggerForm.values) => {
    if (!selectedMatterId) return;
    setTriggerMutation.mutate({
      matterId: selectedMatterId,
      data: {
        trigger_name: values.trigger_name,
        trigger_date: values.trigger_date,
        notes: values.notes || undefined,
      },
    });
  };

  const sortedDeadlines = useMemo(
    () =>
      [...(deadlinesData?.data ?? [])].sort(
        (a: GeneratedDeadline, b: GeneratedDeadline) => new Date(a.computed_date).getTime() - new Date(b.computed_date).getTime(),
      ),
    [deadlinesData],
  );

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Stack>
      <Select
        label="Select Matter"
        placeholder="Choose a matter..."
        data={matterOptions}
        searchable
        clearable
        value={selectedMatterId}
        onChange={setSelectedMatterId}
        style={{ maxWidth: 500 }}
      />

      {selectedMatterId && (
        <>
          {/* Apply Rule Set */}
          <Card withBorder>
            <Group justify="space-between" mb="sm">
              <Text fw={600}>
                <IconGavel size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Applied Rule Sets
              </Text>
              <Button
                size="xs"
                variant="light"
                leftSection={<IconPlus size={14} />}
                onClick={() => setApplyRuleSetOpen(true)}
              >
                Apply Rule Set
              </Button>
            </Group>
            <Text size="sm" c="dimmed">
              Apply a court rule set to this matter, then set trigger dates to auto-generate deadlines.
            </Text>
          </Card>

          {/* Trigger Events */}
          <Card withBorder>
            <Group justify="space-between" mb="sm">
              <Text fw={600}>
                <IconCalendar size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Trigger Events
              </Text>
              <Button
                size="xs"
                variant="light"
                leftSection={<IconPlus size={14} />}
                onClick={() => {
                  triggerForm.reset();
                  setTriggerModalOpen(true);
                }}
              >
                Set Trigger Date
              </Button>
            </Group>

            {triggers.length === 0 ? (
              <Text size="sm" c="dimmed">
                No trigger events set. Set a trigger date (e.g. "Complaint Served") to auto-generate
                deadlines.
              </Text>
            ) : (
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Trigger Event</Table.Th>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Notes</Table.Th>
                    <Table.Th style={{ width: 60 }}>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {triggers.map((t) => (
                    <Table.Tr key={t.id}>
                      <Table.Td>
                        <Badge variant="dot">{formatTriggerName(t.trigger_name)}</Badge>
                      </Table.Td>
                      <Table.Td>{t.trigger_date}</Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed" lineClamp={1}>
                          {t.notes || '--'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Tooltip label="Delete trigger and its deadlines">
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color="red"
                            onClick={() => deleteTriggerMutation.mutate(t.id)}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Card>

          {/* Generated Deadlines Timeline */}
          <Card withBorder>
            <Text fw={600} mb="sm">
              <IconAlarm size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Generated Deadlines ({sortedDeadlines.length})
            </Text>

            {sortedDeadlines.length === 0 ? (
              <Text size="sm" c="dimmed">
                No generated deadlines. Apply a rule set and set trigger dates to generate deadlines
                automatically.
              </Text>
            ) : (
              <Timeline active={-1} bulletSize={24} lineWidth={2}>
                {sortedDeadlines.map((d) => {
                  const isPast = d.computed_date < today;
                  const isToday = d.computed_date === today;
                  return (
                    <Timeline.Item
                      key={d.id}
                      bullet={
                        <IconAlarm
                          size={12}
                          color={isToday ? 'orange' : isPast ? 'gray' : undefined}
                        />
                      }
                      color={isToday ? 'orange' : isPast ? 'gray' : 'blue'}
                    >
                      <Group justify="space-between">
                        <div>
                          <Text size="sm" fw={500} td={isPast ? 'line-through' : undefined}>
                            {d.event_title || d.rule_name || 'Deadline'}
                          </Text>
                          {d.rule_name && d.event_title && (
                            <Text size="xs" c="dimmed">
                              Rule: {d.rule_name}
                            </Text>
                          )}
                        </div>
                        <Badge
                          color={isToday ? 'orange' : isPast ? 'gray' : 'blue'}
                          variant="light"
                        >
                          {d.computed_date}
                        </Badge>
                      </Group>
                    </Timeline.Item>
                  );
                })}
              </Timeline>
            )}
          </Card>
        </>
      )}

      {/* Apply Rule Set Modal */}
      <Modal
        opened={applyRuleSetOpen}
        onClose={() => {
          setApplyRuleSetOpen(false);
          setSelectedRuleSetId(null);
        }}
        title="Apply Rule Set to Matter"
      >
        <Stack>
          <Select
            label="Select Rule Set"
            placeholder="Choose a rule set..."
            data={ruleSetOptions}
            searchable
            value={selectedRuleSetId}
            onChange={setSelectedRuleSetId}
          />
          <Button
            fullWidth
            disabled={!selectedRuleSetId}
            loading={applyRulesMutation.isPending}
            onClick={() => {
              if (selectedMatterId && selectedRuleSetId) {
                applyRulesMutation.mutate({
                  matterId: selectedMatterId,
                  ruleSetId: selectedRuleSetId,
                });
              }
            }}
          >
            Apply Rule Set
          </Button>
        </Stack>
      </Modal>

      {/* Set Trigger Event Modal */}
      <Modal
        opened={triggerModalOpen}
        onClose={() => {
          setTriggerModalOpen(false);
          triggerForm.reset();
        }}
        title="Set Trigger Event Date"
      >
        <form onSubmit={triggerForm.onSubmit(handleSetTrigger)}>
          <Stack>
            <Select
              label="Trigger Event"
              required
              data={TRIGGER_EVENT_OPTIONS}
              searchable
              {...triggerForm.getInputProps('trigger_name')}
            />
            <TextInput
              label="Trigger Date"
              type="date"
              required
              {...triggerForm.getInputProps('trigger_date')}
            />
            <Textarea
              label="Notes"
              placeholder="Optional notes..."
              {...triggerForm.getInputProps('notes')}
            />
            <Button type="submit" fullWidth loading={setTriggerMutation.isPending}>
              Set Trigger & Generate Deadlines
            </Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Statute of Limitations Tab
// ---------------------------------------------------------------------------

function StatuteOfLimitationsTab() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingSol, setEditingSol] = useState<StatuteOfLimitations | null>(null);
  const [daysAhead, setDaysAhead] = useState(365);

  const { data: mattersData } = useQuery({
    queryKey: ['matters', { page: 1, page_size: 200 }],
    queryFn: () => mattersApi.list({ page: 1, page_size: 200 }),
  });

  const matterOptions = useMemo(
    () =>
      (mattersData?.data?.items ?? []).map((m: Matter) => ({
        value: m.id,
        label: `#${m.matter_number} - ${m.title}`,
      })),
    [mattersData],
  );

  const matterMap = useMemo(() => {
    const map = new Map<string, Matter>();
    (mattersData?.data?.items ?? []).forEach((m: Matter) => map.set(m.id, m));
    return map;
  }, [mattersData]);

  const { data: warningsData, isLoading } = useQuery({
    queryKey: ['sol-warnings', daysAhead],
    queryFn: () => deadlinesApi.getSOLWarnings(daysAhead),
  });

  const warnings: StatuteOfLimitations[] = warningsData?.data ?? [];

  const form = useForm({
    initialValues: {
      matter_id: '',
      description: '',
      expiration_date: '',
      statute_reference: '',
      reminder_days: ['90', '60', '30', '7', '1'],
    },
    validate: {
      matter_id: (v) => (v ? null : 'Matter is required'),
      description: (v) => (v.trim() ? null : 'Description is required'),
      expiration_date: (v) => (v ? null : 'Expiration date is required'),
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: {
      matter_id: string;
      description: string;
      expiration_date: string;
      statute_reference?: string;
      reminder_days?: number[];
    }) => deadlinesApi.createSOL(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sol-warnings'] });
      notifications.show({ title: 'Success', message: 'Statute of limitations entry created', color: 'green' });
      setCreateOpen(false);
      form.reset();
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to create SOL entry', color: 'red' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<StatuteOfLimitations> }) => deadlinesApi.updateSOL(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sol-warnings'] });
      notifications.show({ title: 'Success', message: 'SOL entry updated', color: 'green' });
      setEditingSol(null);
      form.reset();
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to update SOL entry', color: 'red' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deadlinesApi.deleteSOL(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sol-warnings'] });
      notifications.show({ title: 'Success', message: 'SOL entry deleted', color: 'green' });
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to delete SOL entry', color: 'red' });
    },
  });

  const handleCreate = (values: typeof form.values) => {
    createMutation.mutate({
      matter_id: values.matter_id,
      description: values.description,
      expiration_date: values.expiration_date,
      statute_reference: values.statute_reference || undefined,
      reminder_days: values.reminder_days.map(Number),
    });
  };

  const handleUpdate = (values: typeof form.values) => {
    if (!editingSol) return;
    updateMutation.mutate({
      id: editingSol.id,
      data: {
        description: values.description,
        expiration_date: values.expiration_date,
        statute_reference: values.statute_reference || undefined,
        reminder_days: values.reminder_days.map(Number),
      },
    });
  };

  const openEdit = (sol: StatuteOfLimitations) => {
    form.setValues({
      matter_id: sol.matter_id,
      description: sol.description,
      expiration_date: sol.expiration_date,
      statute_reference: sol.statute_reference || '',
      reminder_days: (sol.reminder_days || [90, 60, 30, 7, 1]).map(String),
    });
    setEditingSol(sol);
  };

  // Find critical SOL entries (< 30 days)
  const criticalWarnings = warnings.filter(
    (w) => w.days_remaining !== undefined && w.days_remaining < 30,
  );

  const solFormFields = (
    <Stack>
      <Select
        label="Matter"
        required
        data={matterOptions}
        searchable
        disabled={editingSol !== null}
        {...form.getInputProps('matter_id')}
      />
      <TextInput
        label="Description"
        required
        placeholder="e.g. Personal Injury - 2 years"
        {...form.getInputProps('description')}
      />
      <TextInput
        label="Expiration Date"
        type="date"
        required
        {...form.getInputProps('expiration_date')}
      />
      <TextInput
        label="Statute Reference"
        placeholder="e.g. 735 ILCS 5/13-202"
        {...form.getInputProps('statute_reference')}
      />
      <MultiSelect
        label="Reminder Days Before Expiration"
        data={REMINDER_DAY_OPTIONS}
        {...form.getInputProps('reminder_days')}
      />
    </Stack>
  );

  return (
    <Stack>
      {criticalWarnings.length > 0 && (
        <Alert
          icon={<IconAlertTriangle size={20} />}
          title={`${criticalWarnings.length} Statute(s) of Limitations expiring within 30 days!`}
          color="red"
          variant="filled"
        >
          {criticalWarnings.map((w) => {
            const matter = matterMap.get(w.matter_id);
            return (
              <Text key={w.id} size="sm">
                {w.description}
                {matter ? ` (${matter.title})` : ''} — expires {w.expiration_date} (
                {w.days_remaining} days remaining)
              </Text>
            );
          })}
        </Alert>
      )}

      <Group justify="space-between">
        <Group>
          <Select
            label="Show expiring within"
            data={[
              { value: '30', label: '30 days' },
              { value: '90', label: '90 days' },
              { value: '180', label: '180 days' },
              { value: '365', label: '1 year' },
              { value: '730', label: '2 years' },
            ]}
            value={String(daysAhead)}
            onChange={(v) => setDaysAhead(Number(v) || 365)}
            style={{ width: 180 }}
          />
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={() => {
          form.reset();
          setCreateOpen(true);
        }}>
          New SOL Entry
        </Button>
      </Group>

      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : warnings.length === 0 ? (
        <Paper p="xl" withBorder>
          <Text c="dimmed" ta="center">
            No statutes of limitations expiring within {daysAhead} days.
          </Text>
        </Paper>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Matter</Table.Th>
              <Table.Th>Description</Table.Th>
              <Table.Th>Statute Ref.</Table.Th>
              <Table.Th>Expiration</Table.Th>
              <Table.Th>Days Left</Table.Th>
              <Table.Th>Urgency</Table.Th>
              <Table.Th style={{ width: 100 }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {warnings.map((w) => {
              const matter = matterMap.get(w.matter_id);
              const days = w.days_remaining ?? 999;
              const color = getUrgencyColor(days);
              return (
                <Table.Tr key={w.id}>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {matter ? `#${matter.matter_number} - ${matter.title}` : w.matter_id}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{w.description}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {w.statute_reference || '--'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{w.expiration_date}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={700} c={color}>
                      {days}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Box style={{ width: 80 }}>
                      <Progress
                        value={Math.max(0, Math.min(100, 100 - (days / daysAhead) * 100))}
                        color={color}
                        size="lg"
                      />
                    </Box>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <Tooltip label="Edit">
                        <ActionIcon size="sm" variant="subtle" onClick={() => openEdit(w)}>
                          <IconEdit size={14} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Delete">
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="red"
                          onClick={() => deleteMutation.mutate(w.id)}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      {/* Create SOL Modal */}
      <Modal
        opened={createOpen}
        onClose={() => {
          setCreateOpen(false);
          form.reset();
        }}
        title="Create Statute of Limitations Entry"
        size="md"
      >
        <form onSubmit={form.onSubmit(handleCreate)}>
          {solFormFields}
          <Button type="submit" mt="md" fullWidth loading={createMutation.isPending}>
            Create SOL Entry
          </Button>
        </form>
      </Modal>

      {/* Edit SOL Modal */}
      <Modal
        opened={editingSol !== null}
        onClose={() => {
          setEditingSol(null);
          form.reset();
        }}
        title="Edit Statute of Limitations Entry"
        size="md"
      >
        <form onSubmit={form.onSubmit(handleUpdate)}>
          {solFormFields}
          <Button type="submit" mt="md" fullWidth loading={updateMutation.isPending}>
            Save Changes
          </Button>
        </form>
      </Modal>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function DeadlinesPage() {
  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>
          <IconScale size={28} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Rules-Based Deadline Calendaring
        </Title>
      </Group>

      <Tabs defaultValue="rules" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="rules" leftSection={<IconGavel size={16} />}>
            Court Rules
          </Tabs.Tab>
          <Tabs.Tab value="deadlines" leftSection={<IconAlarm size={16} />}>
            Matter Deadlines
          </Tabs.Tab>
          <Tabs.Tab value="sol" leftSection={<IconAlertTriangle size={16} />}>
            Statute of Limitations
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="rules" pt="md">
          <CourtRulesTab />
        </Tabs.Panel>
        <Tabs.Panel value="deadlines" pt="md">
          <MatterDeadlinesTab />
        </Tabs.Panel>
        <Tabs.Panel value="sol" pt="md">
          <StatuteOfLimitationsTab />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
