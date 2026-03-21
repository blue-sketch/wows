import { describe, expect, it } from 'vitest';
import { parseUserCsv } from '../src/server/lib/csv.js';

describe('parseUserCsv', () => {
  it('parses required columns with role fallback', () => {
    const rows = parseUserCsv(
      [
        'username,password,displayName,role',
        'alpha,secret,Alpha Trader,PARTICIPANT',
        'beta,secret,Beta Trader,',
      ].join('\n'),
    );

    expect(rows).toEqual([
      {
        username: 'alpha',
        password: 'secret',
        displayName: 'Alpha Trader',
        role: 'PARTICIPANT',
      },
      {
        username: 'beta',
        password: 'secret',
        displayName: 'Beta Trader',
        role: 'PARTICIPANT',
      },
    ]);
  });
});
