import { useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Collapse,
  Divider,
  Group,
  Menu,
  Modal,
  NumberInput,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconChevronDown,
  IconChevronRight,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mattersApi, tasksApi, workflowsApi, authApi } from '../../api/services';
import type {
  Task,
  TaskPriority,
  TaskStatus,
  WorkflowTemplate,
} from '../../types';
import DataTable from '../../components/DataTable';

// ── Color Maps ───────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'gray',
  medium: 'blue',
  high: 'orange',
  urgent: 'red',
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: 'gray',
  in_progress: 'blue',
  completed: 'green',
  cancelled: 'red',
};

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

// ── Helper to format dates ───────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString();
}

// ── Task Detail Row (expandable) ─────────────────────────────────────

function TaskDetailRow({ task }: { task: Task }) {
  const queryClient = useQueryClient();

  const toggleChecklistMutation = useMutation({
    mutationFn: ({ itemId, isCompleted }: { itemId: string; isCompleted: boolean }) =>
      tasksApi.updateChecklistItem(itemId, { is_completed: isCompleted }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const deleteChecklistMutation = useMutation({
    mutationFn: (itemId: string) => tasksApi.deleteChecklistItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const [newChecklistTitle, setNewChecklistTitle] = useState('');

  const addChecklistMutation = useMutation({
    mutationFn: (title: string) =>
      tasksApi.addChecklistItem(task.id, { title, sort_order: (task.checklist?.length ?? 0) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setNewChecklistTitle('');
    },
  });

  return (
    <Box p="md" bg="var(--mantine-color-gray-light)">
      {task.description && (
        <Text size="sm" mb="sm">{task.description}</Text>
      )}

      {/* Checklist */}
      <Text fw={600} size="sm" mb="xs">Checklist</Text>
      <Stack gap="xs" mb="sm">
        {(task.checklist ?? []).map((item) => (
          <Group key={item.id} gap="xs">
            <Checkbox
              checked={item.is_completed}
              onChange={(e) =>
                toggleChecklistMutation.mutate({
                  itemId: item.id,
                  isCompleted: e.currentTarget.checked,
                })
              }
              label={item.title}
              size="sm"
              styles={{
                label: {
                  textDecoration: item.is_completed ? 'line-through' : undefined,
                  color: item.is_completed ? 'var(--mantine-color-dimmed)' : undefined,
                },
              }}
            />
            <ActionIcon
              variant="subtle"
              color="red"
              size="xs"
              onClick={() => deleteChecklistMutation.mutate(item.id)}
            >
              <IconTrash size={12} />
            </ActionIcon>
          </Group>
        ))}
        <Group gap="xs">
          <TextInput
            placeholder="Add checklist item..."
            size="xs"
            value={newChecklistTitle}
            onChange={(e) => setNewChecklistTitle(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newChecklistTitle.trim()) {
                addChecklistMutation.mutate(newChecklistTitle.trim());
              }
            }}
            style={{ flex: 1 }}
          />
          <Button
            size="xs"
            variant="light"
            disabled={!newChecklistTitle.trim()}
            onClick={() => {
              if (newChecklistTitle.trim()) {
                addChecklistMutation.mutate(newChecklistTitle.trim());
              }
            }}
          >
            Add
          </Button>
        </Group>
      </Stack>

      {/* Dependencies */}
      {(task.dependencies ?? []).length > 0 && (
        <>
          <Text fw={600} size="sm" mb="xs">Dependencies</Text>
          <Stack gap="xs">
            {task.dependencies.map((dep) => (
              <Group key={dep.id} gap="xs">
                <Badge variant="outline" size="sm">
                  Depends on: {dep.depends_on_title || dep.depends_on_id}
                </Badge>
              </Group>
            ))}
          </Stack>
        </>
      )}
    </Box>
  );
}

// ── Create Task Modal ────────────────────────────────────────────────

interface CreateTaskFormValues {
  title: string;
  description: string;
  matter_id: string;
  assigned_to: string;
  priority: TaskPriority;
  due_date: Date | null;
}

function CreateTaskModal({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const { data: mattersData } = useQuery({
    queryKey: ['matters', { page: 1, page_size: 100 }],
    queryFn: () => mattersApi.list({ page: 1, page_size: 100 }),
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => authApi.listUsers(1, 100),
  });

  const matters = mattersData?.data?.items ?? [];
  const users = usersData?.data?.items ?? [];

  const form = useForm<CreateTaskFormValues>({
    initialValues: {
      title: '',
      description: '',
      matter_id: '',
      assigned_to: '',
      priority: 'medium',
      due_date: null,
    },
    validate: {
      title: (value) => (!value.trim() ? 'Title is required' : null),
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: CreateTaskFormValues) =>
      tasksApi.create({
        title: values.title,
        description: values.description || undefined,
        matter_id: values.matter_id || undefined,
        assigned_to: values.assigned_to || undefined,
        priority: values.priority,
        due_date: values.due_date ? values.due_date.toISOString().split('T')[0] : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      notifications.show({
        title: 'Task created',
        message: 'The new task has been created successfully.',
        color: 'green',
      });
      onClose();
      form.reset();
    },
    onError: () => {
      notifications.show({
        title: 'Error',
        message: 'Failed to create task. Please try again.',
        color: 'red',
      });
    },
  });

  const handleSubmit = form.onSubmit((values) => {
    createMutation.mutate(values);
  });

  return (
    <Modal
      opened={opened}
      onClose={() => {
        onClose();
        form.reset();
      }}
      title="New Task"
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="Title"
            placeholder="Task title"
            withAsterisk
            {...form.getInputProps('title')}
          />
          <Textarea
            label="Description"
            placeholder="Optional description"
            minRows={3}
            {...form.getInputProps('description')}
          />
          <Group grow>
            <Select
              label="Matter"
              placeholder="Select matter"
              clearable
              searchable
              data={matters.map((m) => ({
                value: m.id,
                label: m.title,
              }))}
              {...form.getInputProps('matter_id')}
            />
            <Select
              label="Assigned To"
              placeholder="Select assignee"
              clearable
              searchable
              data={users.map((u) => ({
                value: u.id,
                label: `${u.first_name} ${u.last_name}`,
              }))}
              {...form.getInputProps('assigned_to')}
            />
          </Group>
          <Group grow>
            <Select
              label="Priority"
              data={PRIORITY_OPTIONS}
              {...form.getInputProps('priority')}
            />
            <DateInput
              label="Due Date"
              placeholder="Select due date"
              clearable
              {...form.getInputProps('due_date')}
            />
          </Group>
          <Group justify="flex-end" mt="md">
            <Button
              variant="default"
              onClick={() => {
                onClose();
                form.reset();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Create Task
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

// ── Create Workflow Modal ────────────────────────────────────────────

interface WorkflowStepForm {
  title: string;
  description: string;
  assigned_role: string;
  relative_due_days: number | '';
  sort_order: number;
  depends_on_step_order: number | '';
}

interface CreateWorkflowFormValues {
  name: string;
  description: string;
  practice_area: string;
  steps: WorkflowStepForm[];
}

function CreateWorkflowModal({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const form = useForm<CreateWorkflowFormValues>({
    initialValues: {
      name: '',
      description: '',
      practice_area: '',
      steps: [
        { title: '', description: '', assigned_role: '', relative_due_days: '', sort_order: 0, depends_on_step_order: '' },
      ],
    },
    validate: {
      name: (value) => (!value.trim() ? 'Name is required' : null),
      steps: {
        title: (value) => (!value.trim() ? 'Step title is required' : null),
      },
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: CreateWorkflowFormValues) =>
      workflowsApi.create({
        name: values.name,
        description: values.description || undefined,
        practice_area: values.practice_area || undefined,
        steps: values.steps.map((step, idx) => ({
          title: step.title,
          description: step.description || undefined,
          assigned_role: step.assigned_role || undefined,
          relative_due_days: step.relative_due_days !== '' ? Number(step.relative_due_days) : undefined,
          sort_order: idx,
          depends_on_step_order: step.depends_on_step_order !== '' ? Number(step.depends_on_step_order) : undefined,
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      notifications.show({
        title: 'Workflow template created',
        message: 'The workflow template has been created successfully.',
        color: 'green',
      });
      onClose();
      form.reset();
    },
    onError: () => {
      notifications.show({
        title: 'Error',
        message: 'Failed to create workflow template.',
        color: 'red',
      });
    },
  });

  const handleSubmit = form.onSubmit((values) => {
    createMutation.mutate(values);
  });

  const addStep = () => {
    form.insertListItem('steps', {
      title: '',
      description: '',
      assigned_role: '',
      relative_due_days: '',
      sort_order: form.values.steps.length,
      depends_on_step_order: '',
    });
  };

  const removeStep = (index: number) => {
    form.removeListItem('steps', index);
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {
        onClose();
        form.reset();
      }}
      title="New Workflow Template"
      size="xl"
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="Template Name"
            placeholder="e.g., New Civil Litigation"
            withAsterisk
            {...form.getInputProps('name')}
          />
          <Textarea
            label="Description"
            placeholder="Describe this workflow template"
            minRows={2}
            {...form.getInputProps('description')}
          />
          <Select
            label="Practice Area"
            placeholder="Select practice area"
            clearable
            data={[
              { value: 'civil', label: 'Civil' },
              { value: 'criminal', label: 'Criminal' },
              { value: 'family', label: 'Family' },
              { value: 'corporate', label: 'Corporate' },
              { value: 'real_estate', label: 'Real Estate' },
              { value: 'immigration', label: 'Immigration' },
              { value: 'bankruptcy', label: 'Bankruptcy' },
              { value: 'tax', label: 'Tax' },
              { value: 'labor', label: 'Labor' },
              { value: 'intellectual_property', label: 'Intellectual Property' },
              { value: 'estate_planning', label: 'Estate Planning' },
              { value: 'personal_injury', label: 'Personal Injury' },
              { value: 'other', label: 'Other' },
            ]}
            {...form.getInputProps('practice_area')}
          />

          <Divider label="Workflow Steps" labelPosition="center" />

          {form.values.steps.map((_, index) => (
            <Box
              key={index}
              p="sm"
              style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 8 }}
            >
              <Group justify="space-between" mb="xs">
                <Text fw={600} size="sm">Step {index + 1}</Text>
                {form.values.steps.length > 1 && (
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={() => removeStep(index)}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                )}
              </Group>
              <Stack gap="xs">
                <TextInput
                  label="Title"
                  placeholder="Step title"
                  withAsterisk
                  size="sm"
                  {...form.getInputProps(`steps.${index}.title`)}
                />
                <Textarea
                  label="Description"
                  placeholder="Step description"
                  size="sm"
                  minRows={1}
                  {...form.getInputProps(`steps.${index}.description`)}
                />
                <Group grow>
                  <Select
                    label="Assigned Role"
                    placeholder="Role"
                    clearable
                    size="sm"
                    data={[
                      { value: 'attorney', label: 'Attorney' },
                      { value: 'paralegal', label: 'Paralegal' },
                      { value: 'admin', label: 'Admin' },
                      { value: 'billing_clerk', label: 'Billing Clerk' },
                    ]}
                    {...form.getInputProps(`steps.${index}.assigned_role`)}
                  />
                  <NumberInput
                    label="Due in (days)"
                    placeholder="Days from start"
                    size="sm"
                    min={0}
                    {...form.getInputProps(`steps.${index}.relative_due_days`)}
                  />
                  <NumberInput
                    label="Depends on Step #"
                    placeholder="Step order"
                    size="sm"
                    min={0}
                    max={form.values.steps.length - 1}
                    {...form.getInputProps(`steps.${index}.depends_on_step_order`)}
                  />
                </Group>
              </Stack>
            </Box>
          ))}

          <Button variant="light" leftSection={<IconPlus size={14} />} onClick={addStep}>
            Add Step
          </Button>

          <Group justify="flex-end" mt="md">
            <Button
              variant="default"
              onClick={() => {
                onClose();
                form.reset();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Create Template
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

// ── Apply Workflow Modal ─────────────────────────────────────────────

function ApplyWorkflowModal({
  opened,
  onClose,
  template,
}: {
  opened: boolean;
  onClose: () => void;
  template: WorkflowTemplate | null;
}) {
  const queryClient = useQueryClient();
  const [matterId, setMatterId] = useState<string | null>(null);

  const { data: mattersData } = useQuery({
    queryKey: ['matters', { page: 1, page_size: 100 }],
    queryFn: () => mattersApi.list({ page: 1, page_size: 100 }),
    enabled: opened,
  });

  const matters = mattersData?.data?.items ?? [];

  const applyMutation = useMutation({
    mutationFn: () => {
      if (!template || !matterId) throw new Error('Missing data');
      return workflowsApi.apply(template.id, matterId);
    },
    onSuccess: (response) => {
      const taskCount = response?.data?.length ?? 0;
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      notifications.show({
        title: 'Workflow applied',
        message: `Created ${taskCount} tasks from the workflow template.`,
        color: 'green',
      });
      onClose();
      setMatterId(null);
    },
    onError: () => {
      notifications.show({
        title: 'Error',
        message: 'Failed to apply workflow template.',
        color: 'red',
      });
    },
  });

  return (
    <Modal
      opened={opened}
      onClose={() => {
        onClose();
        setMatterId(null);
      }}
      title={`Apply Workflow: ${template?.name ?? ''}`}
      size="md"
    >
      <Stack>
        <Text size="sm" c="dimmed">
          This will create tasks for each step in the workflow template and assign them to the
          selected matter.
        </Text>
        {template && (
          <Box>
            <Text size="sm" fw={600} mb="xs">Steps ({template.steps.length}):</Text>
            {template.steps
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((step) => (
                <Text key={step.id} size="sm" ml="sm">
                  {step.sort_order + 1}. {step.title}
                  {step.relative_due_days != null && (
                    <Text span c="dimmed" size="xs"> (due in {step.relative_due_days} days)</Text>
                  )}
                </Text>
              ))}
          </Box>
        )}
        <Select
          label="Select Matter"
          placeholder="Choose a matter to apply to"
          searchable
          data={matters.map((m) => ({
            value: m.id,
            label: m.title,
          }))}
          value={matterId}
          onChange={setMatterId}
          withAsterisk
        />
        <Group justify="flex-end" mt="md">
          <Button
            variant="default"
            onClick={() => {
              onClose();
              setMatterId(null);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => applyMutation.mutate()}
            loading={applyMutation.isPending}
            disabled={!matterId}
          >
            Apply Workflow
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ── Main Tasks Page ──────────────────────────────────────────────────

export default function TasksPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string | null>('tasks');

  // Task list state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [matterFilter, setMatterFilter] = useState<string | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Modals
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createWorkflowOpen, setCreateWorkflowOpen] = useState(false);
  const [applyWorkflowOpen, setApplyWorkflowOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);

  // Data queries
  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', { page, page_size: pageSize, matter_id: matterFilter, assigned_to: assigneeFilter, status: statusFilter, priority: priorityFilter }],
    queryFn: () =>
      tasksApi.list({
        page,
        page_size: pageSize,
        matter_id: matterFilter || undefined,
        assigned_to: assigneeFilter || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
      }),
  });

  const { data: mattersData } = useQuery({
    queryKey: ['matters', { page: 1, page_size: 100 }],
    queryFn: () => mattersApi.list({ page: 1, page_size: 100 }),
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => authApi.listUsers(1, 100),
  });

  const { data: workflowsData, isLoading: workflowsLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: () => workflowsApi.list(),
    enabled: activeTab === 'workflows',
  });

  const tasks = tasksData?.data?.items ?? [];
  const totalTasks = tasksData?.data?.total ?? 0;
  const matters = mattersData?.data?.items ?? [];
  const users = usersData?.data?.items ?? [];
  const workflows: WorkflowTemplate[] = workflowsData?.data ?? [];

  // Quick status update
  const statusMutation = useMutation({
    mutationFn: ({ taskId, newStatus }: { taskId: string; newStatus: string }) =>
      tasksApi.update(taskId, { status: newStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => tasksApi.delete(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      notifications.show({
        title: 'Task deleted',
        message: 'The task has been deleted.',
        color: 'green',
      });
    },
  });

  const deleteWorkflowMutation = useMutation({
    mutationFn: (templateId: string) => workflowsApi.delete(templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      notifications.show({
        title: 'Template deleted',
        message: 'The workflow template has been deleted.',
        color: 'green',
      });
    },
  });

  // Look up display names
  const getMatterTitle = (id: string | null) => {
    if (!id) return '-';
    const matter = matters.find((m) => m.id === id);
    return matter?.title ?? '-';
  };

  const getAssigneeName = (id: string | null) => {
    if (!id) return '-';
    const user = users.find((u) => u.id === id);
    return user ? `${user.first_name} ${user.last_name}` : '-';
  };

  // Task table columns
  const taskColumns = [
    {
      key: 'expand',
      label: '',
      render: (task: Task) => (
        <ActionIcon
          variant="subtle"
          size="sm"
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            setExpandedTaskId(expandedTaskId === task.id ? null : task.id);
          }}
        >
          {expandedTaskId === task.id ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        </ActionIcon>
      ),
    },
    {
      key: 'title',
      label: 'Title',
      render: (task: Task) => (
        <Text size="sm" fw={500}>{task.title}</Text>
      ),
    },
    {
      key: 'matter',
      label: 'Matter',
      render: (task: Task) => (
        <Text size="sm">{getMatterTitle(task.matter_id)}</Text>
      ),
    },
    {
      key: 'assigned_to',
      label: 'Assigned To',
      render: (task: Task) => (
        <Text size="sm">{getAssigneeName(task.assigned_to)}</Text>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (task: Task) => (
        <Badge color={PRIORITY_COLORS[task.priority]} variant="light" size="sm">
          {task.priority}
        </Badge>
      ),
    },
    {
      key: 'due_date',
      label: 'Due Date',
      render: (task: Task) => {
        if (!task.due_date) return <Text size="sm" c="dimmed">-</Text>;
        const isOverdue = new Date(task.due_date) < new Date() && task.status !== 'completed' && task.status !== 'cancelled';
        return (
          <Text size="sm" c={isOverdue ? 'red' : undefined} fw={isOverdue ? 600 : undefined}>
            {formatDate(task.due_date)}
          </Text>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (task: Task) => (
        <Menu shadow="md" width={160}>
          <Menu.Target>
            <Badge
              color={STATUS_COLORS[task.status]}
              variant="light"
              size="sm"
              style={{ cursor: 'pointer' }}
            >
              {task.status.replace('_', ' ')}
            </Badge>
          </Menu.Target>
          <Menu.Dropdown>
            {STATUS_OPTIONS.map((opt) => (
              <Menu.Item
                key={opt.value}
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  statusMutation.mutate({ taskId: task.id, newStatus: opt.value });
                }}
                disabled={task.status === opt.value}
              >
                <Badge color={STATUS_COLORS[opt.value as TaskStatus]} variant="light" size="xs">
                  {opt.label}
                </Badge>
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (task: Task) => (
        <Tooltip label="Delete task">
          <ActionIcon
            variant="subtle"
            color="red"
            size="sm"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              deleteTaskMutation.mutate(task.id);
            }}
          >
            <IconTrash size={14} />
          </ActionIcon>
        </Tooltip>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Tasks & Workflows</Title>
      </Group>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="tasks">Tasks</Tabs.Tab>
          <Tabs.Tab value="workflows">Workflow Templates</Tabs.Tab>
        </Tabs.List>

        {/* ── Task List Tab ───────────────────────────────────────── */}
        <Tabs.Panel value="tasks" pt="md">
          <Stack>
            <Group justify="space-between">
              <Group>
                <Select
                  placeholder="All matters"
                  clearable
                  searchable
                  data={matters.map((m) => ({
                    value: m.id,
                    label: m.title,
                  }))}
                  value={matterFilter}
                  onChange={(v) => {
                    setMatterFilter(v);
                    setPage(1);
                  }}
                  w={200}
                  size="sm"
                />
                <Select
                  placeholder="All assignees"
                  clearable
                  searchable
                  data={users.map((u) => ({
                    value: u.id,
                    label: `${u.first_name} ${u.last_name}`,
                  }))}
                  value={assigneeFilter}
                  onChange={(v) => {
                    setAssigneeFilter(v);
                    setPage(1);
                  }}
                  w={200}
                  size="sm"
                />
                <Select
                  placeholder="All statuses"
                  clearable
                  data={STATUS_OPTIONS}
                  value={statusFilter}
                  onChange={(v) => {
                    setStatusFilter(v);
                    setPage(1);
                  }}
                  w={150}
                  size="sm"
                />
                <Select
                  placeholder="All priorities"
                  clearable
                  data={PRIORITY_OPTIONS}
                  value={priorityFilter}
                  onChange={(v) => {
                    setPriorityFilter(v);
                    setPage(1);
                  }}
                  w={150}
                  size="sm"
                />
              </Group>
              <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateTaskOpen(true)}>
                New Task
              </Button>
            </Group>

            <DataTable<Task>
              columns={taskColumns}
              data={tasks}
              total={totalTasks}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              onRowClick={(task) => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
              loading={tasksLoading}
            />

            {/* Expanded task detail rows */}
            {tasks.map((task) => (
              <Collapse key={task.id} in={expandedTaskId === task.id}>
                <TaskDetailRow task={task} />
              </Collapse>
            ))}
          </Stack>
        </Tabs.Panel>

        {/* ── Workflow Templates Tab ──────────────────────────────── */}
        <Tabs.Panel value="workflows" pt="md">
          <Stack>
            <Group justify="flex-end">
              <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateWorkflowOpen(true)}>
                New Template
              </Button>
            </Group>

            {workflowsLoading ? (
              <Text c="dimmed">Loading templates...</Text>
            ) : workflows.length === 0 ? (
              <Text c="dimmed" ta="center" py="xl">
                No workflow templates yet. Create one to get started.
              </Text>
            ) : (
              <Stack gap="md">
                {workflows.map((template) => (
                  <Box
                    key={template.id}
                    p="md"
                    style={{
                      border: '1px solid var(--mantine-color-gray-3)',
                      borderRadius: 8,
                    }}
                  >
                    <Group justify="space-between" mb="xs">
                      <Group>
                        <Text fw={600}>{template.name}</Text>
                        {template.practice_area && (
                          <Badge variant="light" size="sm">
                            {template.practice_area.replace('_', ' ')}
                          </Badge>
                        )}
                      </Group>
                      <Group>
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => {
                            setSelectedTemplate(template);
                            setApplyWorkflowOpen(true);
                          }}
                        >
                          Apply to Matter
                        </Button>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="sm"
                          onClick={() => deleteWorkflowMutation.mutate(template.id)}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Group>
                    </Group>
                    {template.description && (
                      <Text size="sm" c="dimmed" mb="sm">{template.description}</Text>
                    )}
                    <Text size="sm" fw={500} mb="xs">
                      Steps ({template.steps.length}):
                    </Text>
                    {template.steps
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((step, idx) => (
                        <Group key={step.id} ml="sm" gap="xs" mb={4}>
                          <Text size="sm">{idx + 1}. {step.title}</Text>
                          {step.assigned_role && (
                            <Badge variant="outline" size="xs">{step.assigned_role}</Badge>
                          )}
                          {step.relative_due_days != null && (
                            <Text size="xs" c="dimmed">({step.relative_due_days} days)</Text>
                          )}
                        </Group>
                      ))}
                  </Box>
                ))}
              </Stack>
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>

      {/* Modals */}
      <CreateTaskModal opened={createTaskOpen} onClose={() => setCreateTaskOpen(false)} />
      <CreateWorkflowModal opened={createWorkflowOpen} onClose={() => setCreateWorkflowOpen(false)} />
      <ApplyWorkflowModal
        opened={applyWorkflowOpen}
        onClose={() => {
          setApplyWorkflowOpen(false);
          setSelectedTemplate(null);
        }}
        template={selectedTemplate}
      />
    </Stack>
  );
}
