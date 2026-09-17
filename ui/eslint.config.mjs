import { FlatCompat } from '@eslint/eslintrc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const baseDirectory = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory });

export default [
  { ignores: ['.next/**', 'dist-ipfs/**', 'out/**', 'next-env.d.ts'] },
  ...compat.extends('next/core-web-vitals'),
];
