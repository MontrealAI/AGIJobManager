import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixtures = vi.hoisted(() => ({
  account: '0x1111111111111111111111111111111111111111',
  manager: '0x3333333333333333333333333333333333333333',
  token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  refetch: vi.fn(), write: vi.fn(), wait: vi.fn(), chainId: 1
}));
vi.mock('wagmi', () => ({
  useAccount: () => ({ isConnected: true, address: fixtures.account }), useChainId: () => fixtures.chainId,
  usePublicClient: () => ({}), useWalletClient: () => ({ data: { getChainId: async () => fixtures.chainId, getAddresses: async () => [fixtures.account] } }),
  useWriteContract: () => ({ writeContractAsync: fixtures.write, data: '0x123' }),
  useSimulateContract: () => ({ refetch: fixtures.refetch }), useWaitForTransactionReceipt: (options: unknown) => { fixtures.wait(options); return {}; }
}));
vi.mock('../src/lib/env', () => ({ env: { chainId: 1, agiJobManagerAddress: fixtures.manager } }));
vi.mock('../src/lib/usdc', async () => {
  const actual = await vi.importActual<any>('../src/lib/usdc');
  return { ...actual, verifyUSDCDeployment: async () => fixtures.token };
});
import { TxStepperButton } from '../src/components/tx/tx-stepper-button';
import { assertSimulatedUSDCRequest } from '../src/lib/usdc';
const abi = [{ type: 'function', name: 'setMaxJobPayout', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] }] as const;
const config = () => ({ address: fixtures.manager, abi, functionName: 'setMaxJobPayout', args: [100n] });

beforeEach(() => { fixtures.refetch.mockReset(); fixtures.write.mockReset(); fixtures.wait.mockReset(); fixtures.chainId = 1; });
afterEach(cleanup);
describe('transaction button simulation and receipt safety', () => {
  it('rejects cached successful data when the fresh simulation fails', async () => {
    fixtures.refetch.mockResolvedValue({ isError: true, error: new Error('Fresh simulation reverted'), data: { request: config() } });
    render(createElement(TxStepperButton, { simulateConfig: config(), children: 'Update maximum' }));
    fireEvent.click(screen.getByRole('button', { name: 'Update maximum' }));
    await screen.findByText(/Fresh simulation reverted/);
    expect(fixtures.write).not.toHaveBeenCalled();
  });
  it('rejects a successful simulation for another destination', async () => {
    fixtures.refetch.mockResolvedValue({ data: { request: { ...config(), address: fixtures.account } } });
    render(createElement(TxStepperButton, { simulateConfig: config(), children: 'Update maximum' }));
    fireEvent.click(screen.getByRole('button', { name: 'Update maximum' }));
    await screen.findByText(/Only the verified USDC manager/);
    expect(fixtures.write).not.toHaveBeenCalled();
  });
  it('rejects changed arguments even when the returned destination is the same manager', async () => {
    fixtures.refetch.mockResolvedValue({ data: { request: { ...config(), args: [200n] } } });
    render(createElement(TxStepperButton, { simulateConfig: config(), children: 'Update maximum' }));
    fireEvent.click(screen.getByRole('button', { name: 'Update maximum' }));
    await screen.findByText(/Transaction details changed/);
    expect(fixtures.write).not.toHaveBeenCalled();
  });
  it('pins receipt polling to the submitted chain when the wallet switches network', async () => {
    fixtures.refetch.mockResolvedValue({ data: { request: config() } });
    fixtures.write.mockResolvedValue('0x123');
    const view = render(createElement(TxStepperButton, { simulateConfig: config(), children: 'Update maximum' }));
    fireEvent.click(screen.getByRole('button', { name: 'Update maximum' }));
    await waitFor(() => expect(fixtures.write).toHaveBeenCalledOnce());
    fixtures.chainId = 11155111;
    view.rerender(createElement(TxStepperButton, { simulateConfig: config(), children: 'Update maximum' }));
    expect(fixtures.wait).toHaveBeenLastCalledWith({ hash: '0x123', chainId: 1 });
  });
  it('also rejects an unexpected native ETH value in a simulated request', () => {
    expect(() => assertSimulatedUSDCRequest({ ...config(), value: 1n }, config())).toThrow('changed');
    expect(() => assertSimulatedUSDCRequest(config(), config())).not.toThrow();
  });
});
