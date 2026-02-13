import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const allowedSchemes = ['https://', 'http://', 'ipfs://', 'ens://'];
export function isAllowedUri(uri: string) {
  const normalized = uri.trim().toLowerCase();
  return allowedSchemes.some((scheme) => normalized.startsWith(scheme));
}

export function safeUri(uri: string) {
  return isAllowedUri(uri) ? uri : null;
}
