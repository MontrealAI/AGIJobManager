# Security Policy

## Reporting a vulnerability

Please report security issues privately.

- Preferred: open a GitHub issue with minimal details and request a private channel.

## Marketplace hardening

The marketplace purchase path (`purchaseNFT`) is protected by OpenZeppelin's `ReentrancyGuard` (`nonReentrant`) because it crosses an external ERC-20 `transferFrom` boundary. Removing this protection requires a contract redeploy even though the public ABI is unchanged.

We will acknowledge receipt and coordinate a fix and disclosure timeline when possible.
