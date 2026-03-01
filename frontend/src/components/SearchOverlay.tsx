import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge, Group, Kbd, Modal, Stack, Text, TextInput, UnstyledButton,
} from '@mantine/core';
import { useDebouncedValue, useHotkeys } from '@mantine/hooks';
import { IconSearch } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { searchApi } from '../api/services';
import type { SearchResult } from '../types';

const TYPE_COLORS: Record<string, string> = {
  client: 'blue',
  matter: 'green',
  contact: 'orange',
  document: 'grape',
};

const TYPE_PATHS: Record<string, string> = {
  client: '/clients',
  matter: '/matters',
  contact: '/contacts',
  document: '/documents',
};

interface Props {
  opened: boolean;
  onClose: () => void;
}

export default function SearchOverlay({ opened, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [debounced] = useDebouncedValue(query, 300);
  const navigate = useNavigate();

  useHotkeys([['mod+K', () => { /* toggle handled by parent */ }]]);

  const { data } = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => searchApi.search(debounced),
    enabled: debounced.length >= 2,
  });

  const results = data?.data?.results || [];

  const handleSelect = (result: SearchResult) => {
    navigate(`${TYPE_PATHS[result.type]}/${result.id}`);
    onClose();
    setQuery('');
  };

  return (
    <Modal
      opened={opened}
      onClose={() => { onClose(); setQuery(''); }}
      title="Search"
      size="lg"
      withCloseButton={false}
    >
      <TextInput
        placeholder="Search clients, matters, contacts, documents..."
        leftSection={<IconSearch size={18} />}
        rightSection={<Kbd>Esc</Kbd>}
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        autoFocus
        size="md"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls="search-results-list"
        aria-autocomplete="list"
      />
      <div
        aria-live="polite"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          borderWidth: 0,
        }}
      >
        {query.length >= 2 ? `${results.length} result${results.length !== 1 ? 's' : ''} found` : ''}
      </div>
      <Stack gap="xs" mt="md" role="listbox" aria-label="Search results" id="search-results-list">
        {results.map((r) => (
          <UnstyledButton
            key={`${r.type}-${r.id}`}
            onClick={() => handleSelect(r)}
            p="sm"
            role="option"
            style={{ borderRadius: 'var(--mantine-radius-sm)', ':hover': { backgroundColor: 'var(--mantine-color-gray-1)' } }}
          >
            <Group justify="space-between">
              <div>
                <Text fw={500}>{r.title}</Text>
                <Text size="xs" c="dimmed">{r.subtitle}</Text>
              </div>
              <Badge color={TYPE_COLORS[r.type]} variant="light" size="sm">
                {r.type}
              </Badge>
            </Group>
          </UnstyledButton>
        ))}
        {query.length >= 2 && results.length === 0 && (
          <Text c="dimmed" ta="center" py="md">No results found</Text>
        )}
      </Stack>
    </Modal>
  );
}
