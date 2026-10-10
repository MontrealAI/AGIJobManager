'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const installedHelper = path.resolve(__dirname, '../scripts/explorer-input-comparison.cjs');
const { publishedInputMatchesBuild: matches } = require(fs.existsSync(installedHelper)
  ? installedHelper : path.join(__dirname, 'explorer-input-comparison.cjs'));

// Exact public link identities, addresses and positions from the operator report
// captured 2026-10-10T08:06:58.718Z. Its source contents were not included.
// Source contents below are equal SYNTHETIC PLACEHOLDERS. These tests exercise
// recorded link metadata; they are not a recompilation of the deployed release.
const REPORT_DATA = {
  "configured": [
    [
      "project/contracts/utils/UriUtils.sol:UriUtils",
      "0x247e5bEED8B7ED6f72384F0aEdfB499fD321F718"
    ],
    [
      "project/contracts/utils/TransferUtils.sol:TransferUtils",
      "0x7F0f756d7803c6CbbBE8f409511bAa173687DC22"
    ],
    [
      "project/contracts/utils/BondMath.sol:BondMath",
      "0xDc73fD21a6a096ac27487c32094A52Fa1A586387"
    ],
    [
      "project/contracts/utils/ReputationMath.sol:ReputationMath",
      "0xD03beEe18c14d99d86F1AbF6149eA6A0a583a427"
    ],
    [
      "project/contracts/utils/ENSOwnership.sol:ENSOwnership",
      "0x3C3F61032273D83Bc0B350F4Db85886c9f214d37"
    ],
    [
      "project/contracts/utils/NftEligibility.sol:NftEligibility",
      "0x21716f5b902855703631730412346F4d2aB019c9"
    ],
    [
      "project/contracts/utils/JobSettlement.sol:JobSettlement",
      "0xA28628B739F1F1ce61221e4500c67E5B9ee7099D"
    ],
    [
      "project/contracts/utils/JobValidation.sol:JobValidation",
      "0xE0c713f2D6ecAe7c08A92B306a8ECc39975e6898"
    ]
  ],
  "targets": [
    {
      "name": "JobSettlement",
      "source": "contracts/utils/JobSettlement.sol",
      "target": "project/contracts/utils/JobSettlement.sol",
      "published": [
        [
          "project/contracts/utils/JobSettlement.sol:ReputationMath",
          "0xd03beee18c14d99d86f1abf6149ea6a0a583a427"
        ],
        [
          "project/contracts/utils/JobSettlement.sol:TransferUtils",
          "0x7f0f756d7803c6cbbbe8f409511baa173687dc22"
        ]
      ],
      "creation": [
        [
          "project/contracts/utils/ReputationMath.sol:ReputationMath",
          [
            {
              "start": 1005,
              "length": 20
            },
            {
              "start": 1566,
              "length": 20
            }
          ]
        ],
        [
          "project/contracts/utils/TransferUtils.sol:TransferUtils",
          [
            {
              "start": 535,
              "length": 20
            }
          ]
        ]
      ],
      "runtime": [
        [
          "project/contracts/utils/ReputationMath.sol:ReputationMath",
          [
            {
              "start": 973,
              "length": 20
            },
            {
              "start": 1534,
              "length": 20
            }
          ]
        ],
        [
          "project/contracts/utils/TransferUtils.sol:TransferUtils",
          [
            {
              "start": 503,
              "length": 20
            }
          ]
        ]
      ]
    },
    {
      "name": "JobValidation",
      "source": "contracts/utils/JobValidation.sol",
      "target": "project/contracts/utils/JobValidation.sol",
      "published": [
        [
          "project/contracts/utils/JobValidation.sol:BondMath",
          "0xdc73fd21a6a096ac27487c32094a52fa1a586387"
        ],
        [
          "project/contracts/utils/JobValidation.sol:TransferUtils",
          "0x7f0f756d7803c6cbbbe8f409511baa173687dc22"
        ]
      ],
      "creation": [
        [
          "project/contracts/utils/BondMath.sol:BondMath",
          [
            {
              "start": 460,
              "length": 20
            }
          ]
        ],
        [
          "project/contracts/utils/TransferUtils.sol:TransferUtils",
          [
            {
              "start": 1158,
              "length": 20
            }
          ]
        ]
      ],
      "runtime": [
        [
          "project/contracts/utils/BondMath.sol:BondMath",
          [
            {
              "start": 428,
              "length": 20
            }
          ]
        ],
        [
          "project/contracts/utils/TransferUtils.sol:TransferUtils",
          [
            {
              "start": 1126,
              "length": 20
            }
          ]
        ]
      ]
    },
    {
      "name": "AGIJobManager",
      "source": "contracts/AGIJobManager.sol",
      "target": "project/contracts/AGIJobManager.sol",
      "published": [
        [
          "project/contracts/AGIJobManager.sol:BondMath",
          "0xdc73fd21a6a096ac27487c32094a52fa1a586387"
        ],
        [
          "project/contracts/AGIJobManager.sol:ENSOwnership",
          "0x3c3f61032273d83bc0b350f4db85886c9f214d37"
        ],
        [
          "project/contracts/AGIJobManager.sol:JobSettlement",
          "0xa28628b739f1f1ce61221e4500c67e5b9ee7099d"
        ],
        [
          "project/contracts/AGIJobManager.sol:JobValidation",
          "0xe0c713f2d6ecae7c08a92b306a8ecc39975e6898"
        ],
        [
          "project/contracts/AGIJobManager.sol:NftEligibility",
          "0x21716f5b902855703631730412346f4d2ab019c9"
        ],
        [
          "project/contracts/AGIJobManager.sol:TransferUtils",
          "0x7f0f756d7803c6cbbbe8f409511baa173687dc22"
        ],
        [
          "project/contracts/AGIJobManager.sol:UriUtils",
          "0x247e5beed8b7ed6f72384f0aedfb499fd321f718"
        ]
      ],
      "creation": [
        [
          "project/contracts/utils/BondMath.sol:BondMath",
          [
            {
              "start": 7961,
              "length": 20
            }
          ]
        ],
        [
          "project/contracts/utils/ENSOwnership.sol:ENSOwnership",
          [
            {
              "start": 21899,
              "length": 20
            },
            {
              "start": 22119,
              "length": 20
            },
            {
              "start": 23443,
              "length": 20
            },
            {
              "start": 23566,
              "length": 20
            }
          ]
        ],
        [
          "project/contracts/utils/JobSettlement.sol:JobSettlement",
          [
            {
              "start": 9243,
              "length": 20
            },
            {
              "start": 9811,
              "length": 20
            },
            {
              "start": 24636,
              "length": 20
            },
            {
              "start": 24868,
              "length": 20
            },
            {
              "start": 25509,
              "length": 20
            }
          ]
        ],
        [
          "project/contracts/utils/JobValidation.sol:JobValidation",
          [
            {
              "start": 10066,
              "length": 20
            },
            {
              "start": 17161,
              "length": 20
            }
          ]
        ],
        [
          "project/contracts/utils/NftEligibility.sol:NftEligibility",
          [
            {
              "start": 11775,
              "length": 20
            },
            {
              "start": 12816,
              "length": 20
            },
            {
              "start": 21336,
              "length": 20
            }
          ]
        ],
        [
          "project/contracts/utils/TransferUtils.sol:TransferUtils",
          [
            {
              "start": 14661,
              "length": 20
            },
            {
              "start": 15380,
              "length": 20
            },
            {
              "start": 19631,
              "length": 20
            },
            {
              "start": 23677,
              "length": 20
            }
          ]
        ],
        [
          "project/contracts/utils/UriUtils.sol:UriUtils",
          [
            {
              "start": 13717,
              "length": 20
            },
            {
              "start": 19357,
              "length": 20
            },
            {
              "start": 26147,
              "length": 20
            }
          ]
        ]
      ],
      "runtime": [
        [
          "project/contracts/utils/BondMath.sol:BondMath",
          [
            {
              "start": 5217,
              "length": 20
            }
          ]
        ],
        [
          "project/contracts/utils/ENSOwnership.sol:ENSOwnership",
          [
            {
              "start": 19155,
              "length": 20
            },
            {
              "start": 19375,
              "length": 20
            },
            {
              "start": 20699,
              "length": 20
            },
            {
              "start": 20822,
              "length": 20
            }
          ]
        ],
        [
          "project/contracts/utils/JobSettlement.sol:JobSettlement",
          [
            {
              "start": 6499,
              "length": 20
            },
            {
              "start": 7067,
              "length": 20
            },
            {
              "start": 21892,
              "length": 20
            },
            {
              "start": 22124,
              "length": 20
            },
            {
              "start": 22765,
              "length": 20
            }
          ]
        ],
        [
          "project/contracts/utils/JobValidation.sol:JobValidation",
          [
            {
              "start": 7322,
              "length": 20
            },
            {
              "start": 14417,
              "length": 20
            }
          ]
        ],
        [
          "project/contracts/utils/NftEligibility.sol:NftEligibility",
          [
            {
              "start": 9031,
              "length": 20
            },
            {
              "start": 10072,
              "length": 20
            },
            {
              "start": 18592,
              "length": 20
            }
          ]
        ],
        [
          "project/contracts/utils/TransferUtils.sol:TransferUtils",
          [
            {
              "start": 11917,
              "length": 20
            },
            {
              "start": 12636,
              "length": 20
            },
            {
              "start": 16887,
              "length": 20
            },
            {
              "start": 20933,
              "length": 20
            }
          ]
        ],
        [
          "project/contracts/utils/UriUtils.sol:UriUtils",
          [
            {
              "start": 10973,
              "length": 20
            },
            {
              "start": 16613,
              "length": 20
            },
            {
              "start": 23403,
              "length": 20
            }
          ]
        ]
      ]
    }
  ]
};
const split = fqn => [fqn.slice(0, fqn.lastIndexOf(':')), fqn.slice(fqn.lastIndexOf(':') + 1)];
const nested = rows => {
  const result = {};
  for (const [fqn, value] of rows) {
    const [source, name] = split(fqn);
    (result[source] ||= {})[name] = structuredClone(value);
  }
  return result;
};
const fixture = (index = 0) => {
  const recorded = REPORT_DATA.targets[index];
  const sourceNames = new Set([...REPORT_DATA.configured.map(([fqn]) => split(fqn)[0]), ...REPORT_DATA.targets.map(target => target.target)]);
  const expected = { language: 'Solidity', sources: Object.fromEntries([...sourceNames].map(source =>
    [source, { content: `// SYNTHETIC EQUAL SOURCE PLACEHOLDER: ${source}` }])), settings: {
    optimizer: { enabled: true, runs: 40 }, viaIR: true, evmVersion: 'shanghai',
    metadata: { bytecodeHash: 'none' }, debug: { revertStrings: 'strip' },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode'], '': ['ast'] } }, libraries: nested(REPORT_DATA.configured),
  } };
  const published = structuredClone(expected);
  published.settings.outputSelection = { '*': { '*': ['evm.bytecode', 'evm.deployedBytecode', 'devdoc', 'userdoc', 'metadata', 'abi'] } };
  published.settings.libraries = nested(recorded.published);
  const artifact = { contractName: recorded.name, sourceName: recorded.source, inputSourceName: recorded.target,
    linkReferences: nested(recorded.creation), deployedLinkReferences: nested(recorded.runtime) };
  return { recorded, expected, published, artifact };
};
const canonicalPublished = f => {
  const published = structuredClone(f.published);
  const required = new Set([...f.recorded.creation, ...f.recorded.runtime].map(([fqn]) => fqn));
  published.settings.libraries = nested(REPORT_DATA.configured.filter(([fqn]) => required.has(fqn)));
  return published;
};
const run = f => matches(f.published, f.expected, f.artifact);
const firstEntry = f => {
  const source = f.artifact.inputSourceName;
  const name = Object.keys(f.published.settings.libraries[source])[0];
  return { source, name, address: f.published.settings.libraries[source][name] };
};

test('recorded target-source grouping accepts all three exact 2/2/7 link sets', () => {
  assert.deepEqual(REPORT_DATA.targets.map(target => target.creation.length), [2, 2, 7]);
  for (let i = 0; i < REPORT_DATA.targets.length; i += 1) {
    const f = fixture(i);
    assert.equal(run(f), true, f.recorded.name);
    assert.equal(f.recorded.runtime.length, f.recorded.creation.length);
    assert(f.recorded.creation.every(([, positions]) => positions.every(p => p.length === 20)));
  }
});

test('canonical exact records and distinct exact/grouped dependencies retain acceptance', () => {
  for (let i = 0; i < 3; i += 1) {
    const f = fixture(i), canonical = canonicalPublished(f);
    assert(matches(canonical, f.expected, f.artifact));
    const { source, name, address } = firstEntry(f);
    const [canonicalFqn] = f.recorded.creation.find(([fqn]) => split(fqn)[1] === name);
    delete f.published.settings.libraries[source][name];
    const [declaringSource] = split(canonicalFqn);
    f.published.settings.libraries[declaringSource] = { [name]: address };
    assert(run(f));
  }
});

test('canonical exact same-name declarations stay accepted while grouped ambiguity is rejected', () => {
  const f = fixture(), { name, address } = firstEntry(f), source2 = 'project/contracts/OtherDeclaration.sol';
  f.expected.sources[source2] = f.published.sources[source2] = { content: '// SYNTHETIC OTHER DECLARATION' };
  f.expected.settings.libraries[source2] = { [name]: address };
  f.artifact.linkReferences[source2] = { [name]: [{ start: 2000, length: 20 }] };
  f.artifact.deployedLinkReferences[source2] = { [name]: [{ start: 1900, length: 20 }] };
  const canonical = canonicalPublished(f);
  canonical.settings.libraries[source2] = { [name]: address };
  assert(matches(canonical, f.expected, f.artifact));
  f.published.settings.libraries[source2] = { [name]: address };
  assert.equal(run(f), false);
});

test('unused configured same-name declarations remain ambiguous even at the same address', () => {
  const f = fixture(), { name, address } = firstEntry(f), source2 = 'project/contracts/UnusedSameName.sol';
  f.expected.sources[source2] = f.published.sources[source2] = { content: '// SYNTHETIC UNUSED DECLARATION' };
  f.expected.settings.libraries[source2] = { [name]: address };
  assert.equal(run(f), false);
  assert(matches(canonicalPublished(f), f.expected, f.artifact));
});

test('grouped source must be the exact known target source, with no path guessing', () => {
  for (const replacement of ['project/contracts/utils/UriUtils.sol', 'project/contracts/utils/JobValidation.sol',
    'contracts/utils/JobSettlement.sol', 'project/contracts/Unknown.sol', 'project//contracts/utils/JobSettlement.sol']) {
    const f = fixture(), group = f.published.settings.libraries[f.artifact.inputSourceName];
    f.published.settings.libraries = { [replacement]: group };
    assert.equal(run(f), false, replacement);
  }
  for (const mutate of [f => { delete f.artifact.inputSourceName; delete f.artifact.sourceName; },
    f => { f.artifact.inputSourceName = 'project/contracts/Absent.sol'; },
    f => { delete f.expected.sources[f.artifact.inputSourceName]; delete f.published.sources[f.artifact.inputSourceName]; }]) {
    const f = fixture(); mutate(f); assert.equal(run(f), false);
  }
  const f = fixture(); f.artifact.sourceName = f.artifact.inputSourceName; delete f.artifact.inputSourceName;
  assert(run(f), 'sourceName fallback is accepted only when already the exact compiler-input source');
});

test('duplicate canonical/grouped aliases cannot conceal a missing dependency at equal cardinality', () => {
  const f = fixture(), { source, name, address } = firstEntry(f);
  const [canonicalFqn] = f.recorded.creation.find(([fqn]) => split(fqn)[1] === name);
  f.published.settings.libraries = { [source]: { [name]: address }, [split(canonicalFqn)[0]]: { [name]: address } };
  assert.equal(Object.values(f.published.settings.libraries).reduce((n, entries) => n + Object.keys(entries).length, 0), 2);
  assert.equal(run(f), false);
});

test('missing, extra, unknown and differently cased library names fail closed', () => {
  for (const mutate of [
    f => { const e = firstEntry(f); delete f.published.settings.libraries[e.source][e.name]; },
    f => { const e = firstEntry(f); f.published.settings.libraries[e.source].UnknownLibrary = e.address; },
    f => { const e = firstEntry(f); delete f.published.settings.libraries[e.source][e.name]; f.published.settings.libraries[e.source][e.name.toLowerCase()] = e.address; },
    f => { const e = firstEntry(f); const [declaring] = split(f.recorded.creation[0][0]); delete f.expected.settings.libraries[declaring]; },
  ]) { const f = fixture(); mutate(f); assert.equal(run(f), false); }
});

test('every recorded address remains binding and checksum casing alone is harmless', () => {
  for (let i = 0; i < 3; i += 1) {
    const base = fixture(i);
    for (const name of Object.keys(base.published.settings.libraries[base.artifact.inputSourceName])) {
      const f = fixture(i);
      f.published.settings.libraries[f.artifact.inputSourceName][name] = `0x${'ff'.repeat(20)}`;
      assert.equal(run(f), false, `${f.recorded.name}:${name}`);
    }
    for (const entries of Object.values(base.published.settings.libraries)) {
      for (const name of Object.keys(entries)) entries[name] = `0x${entries[name].slice(2).toUpperCase()}`;
    }
    assert(run(base));
  }
});

test('invalid address encodings and malformed library structures remain rejected', () => {
  const address = firstEntry(fixture()).address;
  for (const invalid of [address.slice(2), `0X${address.slice(2)}`, ` ${address}`, `${address} `, address.slice(0, -1),
    `${address}00`, `0x${'gg'.repeat(20)}`, '', null, 123, [], {}]) {
    for (const destination of ['published', 'expected']) {
      const f = fixture(), e = firstEntry(f);
      if (destination === 'published') f.published.settings.libraries[e.source][e.name] = invalid;
      else { const [declaring] = split(f.recorded.creation[0][0]); f.expected.settings.libraries[declaring][e.name] = invalid; }
      assert.equal(run(f), false);
    }
  }
  for (const invalid of [null, [], 42, 'bad', { '': {} }, { 'project/contracts/Foo.sol': null }]) {
    const f = fixture(); f.published.settings.libraries = invalid; assert.equal(run(f), false);
  }
});

test('creation-only and runtime-only references are both mandatory', () => {
  for (const move of ['creation-only', 'runtime-only']) {
    const f = fixture(), [fqn] = f.recorded.creation[0], [source, name] = split(fqn);
    delete (move === 'creation-only' ? f.artifact.deployedLinkReferences : f.artifact.linkReferences)[source];
    assert(run(f));
    delete f.published.settings.libraries[f.artifact.inputSourceName][name];
    assert.equal(run(f), false);
  }
});

test('malformed reference objects and positions cannot establish a match', () => {
  for (const value of [null, [], 'bad', { '': {} }, { 'project/contracts/X.sol': null }]) {
    const f = fixture(); f.artifact.linkReferences = value; assert.equal(run(f), false);
  }
  for (const positions of [[], null, {}, [{ start: -1, length: 20 }], [{ start: '0', length: 20 }],
    [{ start: 0, length: 0 }], [{ start: 0, length: '20' }], [{ start: 0.5, length: 20 }], [null]]) {
    const f = fixture(), [source, name] = split(f.recorded.creation[0][0]);
    f.artifact.deployedLinkReferences[source][name] = positions;
    assert.equal(run(f), false);
  }
});

test('all source content and non-exempt compiler fields remain exact', () => {
  for (const mutate of [p => { p.sources[REPORT_DATA.targets[0].target].content += ' changed'; },
    p => { delete p.sources[REPORT_DATA.targets[0].target]; }, p => { p.sources.extra = { content: 'extra' }; },
    p => { p.language = 'Yul'; }, p => { p.settings.optimizer.runs = 200; }, p => { p.settings.viaIR = false; },
    p => { p.settings.evmVersion = 'cancun'; }, p => { p.settings.metadata.bytecodeHash = 'ipfs'; },
    p => { p.settings.debug.revertStrings = 'default'; }, p => { p.settings.unreviewedSetting = true; }]) {
    const f = fixture(); mutate(f.published); assert.equal(run(f), false);
  }
  const f = fixture(); delete f.published.settings.outputSelection; assert(run(f));
});

test('legacy fixtures without references keep exact configured requirements and disable grouping', () => {
  const f = fixture(); delete f.artifact.linkReferences; delete f.artifact.deployedLinkReferences;
  f.published.settings.libraries = structuredClone(f.expected.settings.libraries);
  assert(run(f));
  const allGrouped = {};
  for (const [fqn, address] of REPORT_DATA.configured) allGrouped[split(fqn)[1]] = address;
  f.published.settings.libraries = { [f.artifact.inputSourceName]: allGrouped };
  assert.equal(run(f), false);
});

test('explicit empty link sets still accept omitted unused libraries and reject published links', () => {
  const f = fixture(); f.artifact.linkReferences = {}; f.artifact.deployedLinkReferences = {};
  f.published.settings.libraries = {}; assert(run(f));
  delete f.published.settings.libraries; assert(run(f));
  f.published.settings.libraries = nested([REPORT_DATA.targets[0].published[0]]);
  assert.equal(run(f), false);
});

test('successful and rejected comparisons never mutate artifact or compiler inputs', () => {
  for (let i = 0; i < 3; i += 1) {
    const f = fixture(i), before = JSON.stringify(f);
    assert(run(f)); assert.equal(JSON.stringify(f), before);
    firstEntry(f);
    f.published.settings.optimizer.runs = 41;
    const rejectedBefore = JSON.stringify(f);
    assert.equal(run(f), false); assert.equal(JSON.stringify(f), rejectedBefore);
  }
});
