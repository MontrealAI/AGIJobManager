const fs = require('fs');
const path = require('path');

const artifactPath = path.join(__dirname, '..', 'build', 'contracts', 'AGIJobManager.json');
const outputPath = path.join(__dirname, '..', 'docs', 'Interface.md');

if (!fs.existsSync(artifactPath)) {
  throw new Error('Missing build/contracts/AGIJobManager.json. Run `npx truffle compile` first.');
}

const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
const abi = Array.isArray(artifact.abi) ? artifact.abi : [];

const constructorEntry = abi.find((entry) => entry.type === 'constructor');
const functions = abi.filter((entry) => entry.type === 'function');
const events = abi.filter((entry) => entry.type === 'event');
const errors = abi.filter((entry) => entry.type === 'error');

const formatInputs = (inputs = []) =>
  inputs.map((input) => `${input.type}${input.name ? ` ${input.name}` : ''}`).join(', ');

const formatOutputs = (outputs = []) => (outputs.length ? outputs.map((o) => o.type).join(', ') : '—');

const formatEventInputs = (inputs = []) =>
  inputs.length
    ? inputs
        .map((input) => `${input.indexed ? 'indexed ' : ''}${input.type}${input.name ? ` ${input.name}` : ''}`)
        .join(', ')
    : '—';

const constructorSignature = constructorEntry
  ? `constructor(${formatInputs(constructorEntry.inputs)})`
  : 'No constructor entry in ABI.';

const functionRows = functions
  .map(
    (fn) =>
      `| \`${fn.name}(${formatInputs(fn.inputs)})\` | ${fn.stateMutability} | ${formatOutputs(fn.outputs)} |`
  )
  .join('\n');

const eventRows = events
  .map((event) => `| \`${event.name}(${formatInputs(event.inputs)})\` | ${formatEventInputs(event.inputs)} |`)
  .join('\n');

const errorRows = errors.length
  ? errors
      .map((error) => {
        const inputs = formatInputs(error.inputs);
        return `| \`${error.name}(${inputs})\` | ${inputs || '—'} |`;
      })
      .join('\n')
  : '| _None_ | — |';

const content = `# AGIJobManager interface reference

> Generated from \`build/contracts/AGIJobManager.json\`. Regenerate with:
>
> \`node scripts/generate-interface-doc.js\`

## Constructor
\`${constructorSignature}\`

## Functions
| Signature | State mutability | Returns |
| --- | --- | --- |
${functionRows}

## Events
| Event | Indexed fields |
| --- | --- |
${eventRows}

## Custom errors
| Error | Inputs |
| --- | --- |
${errorRows}
`;

fs.writeFileSync(outputPath, content);
console.log(`Wrote ${outputPath}`);
