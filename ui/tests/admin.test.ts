import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Admin from '../src/app/admin/page';
import Home from '../src/app/page';
import Detail from '../src/app/jobs/[jobId]/page';
import Jobs from '../src/app/jobs/page';
const state = vi.hoisted(() => ({ query: {} as any, push: vi.fn() }));
vi.mock('../src/lib/web3/queries', () => ({ usePlatformSummary: () => state.query, useJob: () => state.query, useJobs: () => state.query }));
vi.mock('../src/lib/demo', () => ({ isDemoMode: false, useDemoScenario: () => ({}), useDemoRoleFlags: () => ({ actor: 'visitor' }) }));
vi.mock('next/navigation', () => ({ useParams: () => ({ jobId: '0' }), useRouter: () => ({ push: state.push }) }));
afterEach(cleanup);
describe('dashboard unavailable and missing states', () => {
  it('does not present failed reads as zero counters', () => {
    state.query = { isError: true, refetch: vi.fn() }; render(React.createElement(Home));
    expect(screen.getByText('Job count unavailable.')).toBeTruthy();
    expect(screen.getByText('Configuration unavailable.')).toBeTruthy();
    expect(screen.queryByText(/0 total ids/)).toBeNull();
  });
  it('shows an actionable job read error, not perpetual loading', () => {
    state.query = { isError: true, refetch: vi.fn() }; render(React.createElement(Detail));
    expect(screen.getByRole('alert').textContent).toContain('Job unavailable');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(screen.queryByText(/Loading/)).toBeNull();
  });
  it('distinguishes an absent job from loading or RPC failure', () => {
    state.query = { data: { job: null } }; render(React.createElement(Detail));
    expect(screen.getByText('Job #0 was not found in this snapshot.')).toBeTruthy();
  });
  it('hides stale page data and disables export after a failed refresh', () => {
    state.query = { isError: true, data: { jobs: [{ id: 123n }] }, refetch: vi.fn() }; render(React.createElement(Jobs));
    expect(screen.getByRole('alert').textContent).toContain('Jobs unavailable');
    expect((screen.getByRole('button', { name: 'Copy CSV export' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByTestId('csv-output')).toBeNull();
  });
  it('labels admin as read-only and links the maintained console without a wallet', () => {
    state.query = { isError: true, refetch: vi.fn() }; render(React.createElement(Admin));
    expect(screen.getByText(/This dashboard is read-only/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open the USDC console' }).getAttribute('href')).toBe('https://montrealai.github.io/AGIJobManager/agijobmanager-usdc.html');
    expect(screen.getByRole('alert').textContent).toContain('Configuration unavailable');
    expect(screen.queryByPlaceholderText(/Type PAUSE/)).toBeNull();
  });
});
