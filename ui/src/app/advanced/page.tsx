'use client';

import { useMemo, useRef, useState } from 'react';
import type { AbiFunction } from 'viem';
import { Card } from '@/components/ui/card';
import { agiJobManagerAbi } from '@/abis/agiJobManager';
import { publicClient } from '@/lib/web3/publicClient';
import { decodeError } from '@/lib/web3/errors';
import { useAccount, useWalletClient } from 'wagmi';
import { CONTRACT_ADDRESS, EXPLORER } from '@/lib/constants';

type CallState = {
  phase: 'idle' | 'prepare' | 'simulate' | 'sign' | 'pending' | 'confirmed' | 'failed';
  result?: string;
  error?: string;
  txHash?: `0x${string}`;
};

const fnAbi = agiJobManagerAbi.filter((entry) => entry.type === 'function') as readonly AbiFunction[];

function stringify(value: unknown) {
  return JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2);
}

function parseArgs(raw: string): unknown[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const parsed = JSON.parse(trimmed) as unknown;
  if (!Array.isArray(parsed)) throw new Error('Arguments must be a JSON array.');
  return parsed;
}

export default function AdvancedPage() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [states, setStates] = useState<Record<string, CallState>>({});
  const inFlightWritesRef = useRef<Set<string>>(new Set());

  const functions = useMemo(() => fnAbi, []);

  const updateState = (key: string, next: Partial<CallState>) => {
    setStates((prev) => ({ ...prev, [key]: { ...prev[key], phase: next.phase ?? prev[key]?.phase ?? 'idle', ...next } }));
  };

  const runRead = async (fn: AbiFunction) => {
    const key = `${fn.name}-read`;
    try {
      updateState(key, { phase: 'prepare', error: undefined });
      const args = parseArgs(inputs[key] || '[]');
      updateState(key, { phase: 'pending' });
      const value = await (publicClient as any).readContract({
        address: CONTRACT_ADDRESS,
        abi: agiJobManagerAbi,
        functionName: fn.name,
        args
      });
      updateState(key, { phase: 'confirmed', result: stringify(value) });
    } catch (error) {
      const decoded = decodeError(error);
      updateState(key, { phase: 'failed', error: `${decoded.name}: ${decoded.human}` });
    }
  };

  const runWrite = async (fn: AbiFunction) => {
    const key = `${fn.name}-write`;
    if (inFlightWritesRef.current.has(key)) return;
    inFlightWritesRef.current.add(key);
    try {
      updateState(key, { phase: 'prepare', error: undefined, txHash: undefined });
      const args = parseArgs(inputs[key] || '[]');
      const account = address ?? walletClient?.account.address;
      if (!account || !walletClient) {
        throw new Error('Wallet required for simulations and writes.');
      }
      updateState(key, { phase: 'simulate' });
      const simulation = await (publicClient as any).simulateContract({
        address: CONTRACT_ADDRESS,
        abi: agiJobManagerAbi,
        functionName: fn.name,
        args,
        account
      });
      updateState(key, { phase: 'sign', result: stringify(simulation.request) });
      const txHash = await (walletClient as any).writeContract(simulation.request as any);
      updateState(key, { phase: 'pending', txHash });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      updateState(key, { phase: 'confirmed' });
    } catch (error) {
      const decoded = decodeError(error);
      updateState(key, { phase: 'failed', error: `${decoded.name}: ${decoded.human}` });
    } finally {
      inFlightWritesRef.current.delete(key);
    }
  };

  return (
    <div className="container-shell py-8 space-y-4" data-testid="advanced-console">
      <Card>
        <h1 className="text-3xl font-serif">Advanced Contract Console</h1>
        <p className="text-sm text-muted-foreground mt-2">Full ABI surface with simulation-first writes. Provide arguments as JSON array.</p>
      </Card>
      {functions.map((fn) => {
        const isRead = fn.stateMutability === 'view' || fn.stateMutability === 'pure';
        const key = `${fn.name}-${isRead ? 'read' : 'write'}`;
        const state = states[key];
        return (
          <Card key={key} data-testid={`advanced-function-${fn.name}`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">{fn.name}</h2>
              <span className="text-xs text-muted-foreground">{fn.stateMutability}</span>
            </div>
            <p className="text-xs mt-1 text-muted-foreground">inputs: {fn.inputs.map((input) => `${input.name || '_'}:${input.type}`).join(', ') || 'none'}</p>
            <textarea
              className="mt-3 w-full min-h-20 rounded border border-border bg-background p-2 text-xs font-mono"
              value={inputs[key] || '[]'}
              onChange={(event) => setInputs((prev) => ({ ...prev, [key]: event.target.value }))}
              aria-label={`${fn.name} args`}
            />
            <div className="mt-3 flex items-center gap-3">
              <button
                className="rounded border border-border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => (isRead ? runRead(fn) : runWrite(fn))}
                data-testid={`advanced-run-${fn.name}`}
                disabled={state?.phase === 'prepare' || state?.phase === 'simulate' || state?.phase === 'sign' || state?.phase === 'pending'}
              >
                {state?.phase === 'prepare' || state?.phase === 'simulate' || state?.phase === 'sign' || state?.phase === 'pending'
                  ? 'In progress…'
                  : isRead
                    ? 'Run read'
                    : 'Simulate → Sign'}
              </button>
              <span className="text-xs text-muted-foreground">Phase: {state?.phase ?? 'idle'}</span>
              {state?.txHash && <a href={`${EXPLORER}/tx/${state.txHash}`} target="_blank" rel="noreferrer" className="text-xs underline">Explorer</a>}
            </div>
            {state?.result && <pre className="mt-3 overflow-x-auto text-xs">{state.result}</pre>}
            {state?.error && <p className="mt-3 text-sm text-red-400">{state.error}</p>}
          </Card>
        );
      })}
    </div>
  );
}
