// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../utils/recordings-service', () => ({
  fetchRecordingsPage: jest.fn(),
  groupRecordingsByPeriod: jest.requireActual('../utils/recordings-service').groupRecordingsByPeriod,
}));

jest.mock('../utils/query-client', () => ({
  queryClient: {
    invalidateQueries: jest.fn(),
    resetQueries: jest.fn(),
  },
}));

jest.mock('../components/RecordingRow', () => ({
  RecordingRow: ({ recording }: { recording: { id: string } }) => {
    const { Text } = require('react-native');
    return <Text testID={`row-${recording.id}`}>{recording.id}</Text>;
  },
}));

jest.mock('../locales', () => ({
  useI18n: () => ({
    t: {
      recordings: {
        thisWeek: 'THIS WEEK',
        lastWeek: 'LAST WEEK',
        older: 'OLDER',
        errorLoading: 'Failed to load recordings.',
        retry: 'Retry',
      },
    },
  }),
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...rest }: any) => <View {...rest}>{children}</View>,
  };
});

jest.mock('../utils/auth-storage', () => ({
  getAuthStudyId: jest.fn().mockResolvedValue('S1'),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RecordingsList } from '../components/RecordingsList';
import { fetchRecordingsPage } from '../utils/recordings-service';
import type { Recording } from '../utils/recordings-service';

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeRecording = (id: string): Recording => ({
  id,
  timestamp: new Date().toISOString(),
  studyId: 'S1',
  status: 'uploaded',
  s3Key: `key/${id}`,
});

const makePage = (recordings: Recording[], hasMore = false) => ({
  recordings,
  totalPages: hasMore ? 2 : 1,
  hasMore,
});

/** Wrap component in a fresh QueryClient for test isolation */
const renderWithQuery = (ui: React.ReactElement) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RecordingsList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading indicator while fetching', async () => {
    (fetchRecordingsPage as jest.Mock).mockReturnValue(new Promise(() => {})); // never resolves
    renderWithQuery(<RecordingsList />);
    expect(screen.getByTestId('recordings-loading')).toBeTruthy();
  });

  it('renders recording rows after successful fetch', async () => {
    (fetchRecordingsPage as jest.Mock).mockResolvedValue(
      makePage([makeRecording('rec-1'), makeRecording('rec-2')])
    );
    renderWithQuery(<RecordingsList />);
    await waitFor(() => expect(screen.getByTestId('row-rec-1')).toBeTruthy());
    expect(screen.getByTestId('row-rec-2')).toBeTruthy();
  });

  it('shows error UI and retry button when fetch fails', async () => {
    (fetchRecordingsPage as jest.Mock).mockRejectedValue(new Error('Network error'));
    renderWithQuery(<RecordingsList />);
    await waitFor(() => expect(screen.getByText('Failed to load recordings.')).toBeTruthy());
    expect(screen.getByText('Retry')).toBeTruthy();
  });

  it('calls onEmpty when fetch returns no recordings', async () => {
    (fetchRecordingsPage as jest.Mock).mockResolvedValue(makePage([]));
    const onEmpty = jest.fn();
    renderWithQuery(<RecordingsList onEmpty={onEmpty} />);
    await waitFor(() => expect(onEmpty).toHaveBeenCalledTimes(1));
  });

  it('does not call onEmpty when recordings exist', async () => {
    (fetchRecordingsPage as jest.Mock).mockResolvedValue(makePage([makeRecording('r1')]));
    const onEmpty = jest.fn();
    renderWithQuery(<RecordingsList onEmpty={onEmpty} />);
    await waitFor(() => screen.getByTestId('row-r1'));
    expect(onEmpty).not.toHaveBeenCalled();
  });

  it('pull-to-refresh triggers refetch', async () => {
    (fetchRecordingsPage as jest.Mock).mockResolvedValue(makePage([makeRecording('r1')]));
    renderWithQuery(<RecordingsList />);
    await waitFor(() => screen.getByTestId('recordings-list'));
    const list = screen.getByTestId('recordings-list');
    fireEvent(list, 'refresh');
    await waitFor(() => expect(fetchRecordingsPage).toHaveBeenCalledTimes(2));
  });
});
