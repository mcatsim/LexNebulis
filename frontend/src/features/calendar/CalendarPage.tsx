import { useCallback, useMemo, useState } from 'react';
import {
  Button,
  Group,
  Modal,
  Select,
  Stack,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { DateSelectArg, EventClickArg, DatesSetArg, EventInput } from '@fullcalendar/core';
import { calendarApi, mattersApi, authApi } from '../../api/services';
import type { CalendarEvent, EventType } from '../../types';

const EVENT_TYPE_COLORS: Record<EventType, string> = {
  court_date: '#e03131',
  deadline: '#f08c00',
  filing: '#2f9e44',
  meeting: '#1971c2',
  reminder: '#7048e8',
};

const EVENT_TYPE_OPTIONS: { value: EventType; label: string }[] = [
  { value: 'court_date', label: 'Court Date' },
  { value: 'deadline', label: 'Deadline' },
  { value: 'filing', label: 'Filing' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'reminder', label: 'Reminder' },
];

interface EventFormValues {
  title: string;
  event_type: EventType;
  start_datetime: string;
  end_datetime: string;
  matter_id: string;
  assigned_to: string;
  location: string;
  description: string;
}

function toLocalDateTimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10),
  });
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const form = useForm<EventFormValues>({
    initialValues: {
      title: '',
      event_type: 'meeting',
      start_datetime: '',
      end_datetime: '',
      matter_id: '',
      assigned_to: '',
      location: '',
      description: '',
    },
    validate: {
      title: (v) => (v.trim() ? null : 'Title is required'),
      event_type: (v) => (v ? null : 'Event type is required'),
      start_datetime: (v) => (v ? null : 'Start date/time is required'),
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
    () => [
      { value: '', label: '(No matter)' },
      ...(mattersData?.data?.items ?? []).map((m) => ({
        value: m.id,
        label: `${m.matter_number} - ${m.title}`,
      })),
    ],
    [mattersData],
  );

  const userOptions = useMemo(
    () => [
      { value: '', label: '(Unassigned)' },
      ...(usersData?.data?.items ?? []).map((u) => ({
        value: u.id,
        label: `${u.first_name} ${u.last_name}`,
      })),
    ],
    [usersData],
  );

  const { data: eventsData } = useQuery({
    queryKey: ['calendar-events', dateRange],
    queryFn: () =>
      calendarApi.list({
        start_date: dateRange.start,
        end_date: dateRange.end,
        page: 1,
        page_size: 500,
      }),
  });

  const calendarEvents: EventInput[] = useMemo(
    () =>
      (eventsData?.data?.items ?? []).map((evt: CalendarEvent) => ({
        id: evt.id,
        title: evt.title,
        start: evt.start_datetime,
        end: evt.end_datetime ?? undefined,
        allDay: evt.all_day,
        backgroundColor: EVENT_TYPE_COLORS[evt.event_type] ?? '#868e96',
        borderColor: EVENT_TYPE_COLORS[evt.event_type] ?? '#868e96',
        extendedProps: {
          event_type: evt.event_type,
          matter_id: evt.matter_id,
          assigned_to: evt.assigned_to,
          location: evt.location,
          description: evt.description,
          status: evt.status,
        },
      })),
    [eventsData],
  );

  const createMutation = useMutation({
    mutationFn: (data: Partial<CalendarEvent>) => calendarApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      notifications.show({ title: 'Success', message: 'Event created', color: 'green' });
      setCreateModalOpen(false);
      form.reset();
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to create event', color: 'red' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CalendarEvent> }) =>
      calendarApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      notifications.show({ title: 'Success', message: 'Event updated', color: 'green' });
      setEditModalOpen(false);
      setSelectedEventId(null);
      form.reset();
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to update event', color: 'red' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => calendarApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      notifications.show({ title: 'Success', message: 'Event deleted', color: 'green' });
      setEditModalOpen(false);
      setSelectedEventId(null);
      form.reset();
    },
    onError: () => {
      notifications.show({ title: 'Error', message: 'Failed to delete event', color: 'red' });
    },
  });

  const buildPayload = (values: EventFormValues): Partial<CalendarEvent> => ({
    title: values.title,
    event_type: values.event_type,
    start_datetime: new Date(values.start_datetime).toISOString(),
    end_datetime: values.end_datetime
      ? new Date(values.end_datetime).toISOString()
      : undefined,
    matter_id: values.matter_id || null,
    assigned_to: values.assigned_to || null,
    location: values.location || null,
    description: values.description || null,
  });

  const handleCreate = (values: EventFormValues) => {
    createMutation.mutate(buildPayload(values));
  };

  const handleUpdate = (values: EventFormValues) => {
    if (!selectedEventId) return;
    updateMutation.mutate({ id: selectedEventId, data: buildPayload(values) });
  };

  const handleDelete = () => {
    if (!selectedEventId) return;
    deleteMutation.mutate(selectedEventId);
  };

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setDateRange({
      start: arg.start.toISOString().slice(0, 10),
      end: arg.end.toISOString().slice(0, 10),
    });
  }, []);

  const handleDateSelect = useCallback(
    (selectInfo: DateSelectArg) => {
      form.reset();
      form.setValues({
        title: '',
        event_type: 'meeting',
        start_datetime: toLocalDateTimeString(selectInfo.start),
        end_datetime: selectInfo.end
          ? toLocalDateTimeString(selectInfo.end)
          : '',
        matter_id: '',
        assigned_to: '',
        location: '',
        description: '',
      });
      setCreateModalOpen(true);
    },
    [form],
  );

  const handleEventClick = useCallback(
    (clickInfo: EventClickArg) => {
      const evt = clickInfo.event;
      setSelectedEventId(evt.id);
      form.setValues({
        title: evt.title,
        event_type: (evt.extendedProps.event_type as EventType) ?? 'meeting',
        start_datetime: evt.start ? toLocalDateTimeString(evt.start) : '',
        end_datetime: evt.end ? toLocalDateTimeString(evt.end) : '',
        matter_id: (evt.extendedProps.matter_id as string) ?? '',
        assigned_to: (evt.extendedProps.assigned_to as string) ?? '',
        location: (evt.extendedProps.location as string) ?? '',
        description: (evt.extendedProps.description as string) ?? '',
      });
      setEditModalOpen(true);
    },
    [form],
  );

  const eventFormFields = (
    <Stack>
      <TextInput
        label="Title"
        required
        {...form.getInputProps('title')}
      />
      <Select
        label="Event Type"
        data={EVENT_TYPE_OPTIONS}
        required
        {...form.getInputProps('event_type')}
      />
      <TextInput
        label="Start"
        type="datetime-local"
        required
        {...form.getInputProps('start_datetime')}
      />
      <TextInput
        label="End"
        type="datetime-local"
        {...form.getInputProps('end_datetime')}
      />
      <Select
        label="Matter"
        data={matterOptions}
        searchable
        clearable
        {...form.getInputProps('matter_id')}
      />
      <Select
        label="Assigned To"
        data={userOptions}
        searchable
        clearable
        {...form.getInputProps('assigned_to')}
      />
      <TextInput
        label="Location"
        placeholder="Optional"
        {...form.getInputProps('location')}
      />
      <Textarea
        label="Description"
        placeholder="Optional"
        autosize
        minRows={2}
        {...form.getInputProps('description')}
      />
    </Stack>
  );

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Calendar</Title>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => {
            form.reset();
            const now = new Date();
            form.setValues({
              title: '',
              event_type: 'meeting',
              start_datetime: toLocalDateTimeString(now),
              end_datetime: toLocalDateTimeString(new Date(now.getTime() + 60 * 60 * 1000)),
              matter_id: '',
              assigned_to: '',
              location: '',
              description: '',
            });
            setCreateModalOpen(true);
          }}
        >
          New Event
        </Button>
      </Group>

      <div style={{ minHeight: 600 }}>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          editable={false}
          selectable
          selectMirror
          dayMaxEvents
          events={calendarEvents}
          select={handleDateSelect}
          eventClick={handleEventClick}
          datesSet={handleDatesSet}
          height="auto"
        />
      </div>

      {/* Create Event Modal */}
      <Modal
        opened={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          form.reset();
        }}
        title="Create Event"
        size="md"
      >
        <form onSubmit={form.onSubmit(handleCreate)}>
          {eventFormFields}
          <Button type="submit" mt="md" fullWidth loading={createMutation.isPending}>
            Create Event
          </Button>
        </form>
      </Modal>

      {/* Edit Event Modal */}
      <Modal
        opened={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedEventId(null);
          form.reset();
        }}
        title="Edit Event"
        size="md"
      >
        <form onSubmit={form.onSubmit(handleUpdate)}>
          {eventFormFields}
          <Group mt="md" justify="space-between">
            <Button
              color="red"
              variant="outline"
              onClick={handleDelete}
              loading={deleteMutation.isPending}
            >
              Delete Event
            </Button>
            <Button type="submit" loading={updateMutation.isPending}>
              Save Changes
            </Button>
          </Group>
        </form>
      </Modal>
    </Stack>
  );
}
