import { describe, it, expect } from 'vitest';
import { translateError } from '@/lib/web3/errors';

describe('error mapping', () => {
  it('maps custom errors', () => {
    expect(translateError('NotAuthorized')).toContain('Not authorized');
    expect(translateError('SettlementPaused')).toContain('Settlement paused');
  });
});
