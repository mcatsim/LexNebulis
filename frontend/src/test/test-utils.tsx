import React, { type ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';

/**
 * Creates a fresh QueryClient configured for testing:
 * - retries disabled so failures surface immediately
 * - gcTime set to Infinity to avoid garbage-collection races
 */
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface WrapperProps {
  children: React.ReactNode;
}

/**
 * AllProviders wraps the component tree with the same providers used in
 * production (MantineProvider, QueryClientProvider, Router, Modals,
 * Notifications) so component tests run in a realistic context.
 */
function createWrapper(queryClient?: QueryClient, initialEntries?: string[]) {
  const client = queryClient ?? createTestQueryClient();

  return function AllProviders({ children }: WrapperProps) {
    const Router = initialEntries ? MemoryRouter : BrowserRouter;
    const routerProps = initialEntries ? { initialEntries } : {};

    return (
      <QueryClientProvider client={client}>
        <MantineProvider defaultColorScheme="light">
          <ModalsProvider>
            <Notifications position="top-right" />
            {/* @ts-expect-error MemoryRouter and BrowserRouter accept different props */}
            <Router {...routerProps}>{children}</Router>
          </ModalsProvider>
        </MantineProvider>
      </QueryClientProvider>
    );
  };
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
  initialEntries?: string[];
}

/**
 * Custom render that wraps the component with all required providers.
 * Returns the standard RTL result plus a pre-configured userEvent instance.
 */
function customRender(ui: ReactElement, options: CustomRenderOptions = {}) {
  const { queryClient, initialEntries, ...renderOptions } = options;
  const Wrapper = createWrapper(queryClient, initialEntries);
  const user = userEvent.setup();

  return {
    user,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

export { customRender as render, screen, within, waitFor, userEvent, createTestQueryClient };
