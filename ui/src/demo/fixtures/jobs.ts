import { getScenario } from '@/lib/demo/scenarios';

const Z = '0x0000000000000000000000000000000000000000';
const EMP = '0x1111111111111111111111111111111111111111';
const AGT = '0x2222222222222222222222222222222222222222';

export type DemoJob = {
  id: number;
  core: readonly [string, string, bigint, bigint, bigint, boolean, boolean, boolean, number];
  val: readonly [boolean, bigint, bigint, bigint, bigint];
  spec: string;
  completion: string;
};

const base: DemoJob[] = [
  { id: 0, core: [EMP, Z, 10_000000000000000000n, 86400n, 0n, false, false, false, 0], val: [false, 0n, 0n, 0n, 0n], spec: 'https://example.org/spec/0', completion: '' },
  { id: 1, core: [EMP, AGT, 45_000000000000000000n, 86400n, 1700000000n, false, false, false, 0], val: [false, 0n, 0n, 0n, 0n], spec: 'ipfs://bafybeigdyrzt', completion: '' },
  { id: 2, core: [EMP, AGT, 55_000000000000000000n, 86400n, 1700000000n, false, false, false, 0], val: [true, 3n, 0n, 1700003600n, 0n], spec: 'ens://jobs.agi.eth/2', completion: 'https://example.org/completion/2' },
  { id: 3, core: [EMP, AGT, 12_000000000000000000n, 86400n, 1700000000n, false, true, false, 0], val: [true, 1n, 2n, 1700003600n, 1700007200n], spec: 'javascript:alert(1)', completion: 'https://example.org/completion/3' },
  { id: 4, core: [EMP, AGT, 15_000000000000000000n, 86400n, 1700000000n, true, false, false, 0], val: [true, 4n, 0n, 1700003600n, 0n], spec: 'https://example.org/spec/4', completion: 'https://example.org/completion/4' },
  { id: 5, core: [Z, Z, 0n, 0n, 0n, false, false, false, 0], val: [false, 0n, 0n, 0n, 0n], spec: '', completion: '' }
];

export function jobsForScenario(id?: string) {
  const scenario = getScenario(id);
  if (scenario.id === 'open') return [base[0]];
  if (scenario.id === 'assigned') return [base[1]];
  if (scenario.id === 'completion') return [base[2]];
  if (scenario.id === 'disputed') return [base[3]];
  if (scenario.id === 'settled') return [base[4]];
  return base;
}
