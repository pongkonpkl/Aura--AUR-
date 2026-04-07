# Local Funding Transaction Log

This file documents local-only funding transfers used to bootstrap testing and deployment.

## 2026-04-07

- Purpose: bootstrap local chain operations and gas testing.
- Network: `localhost` (Hardhat node).
- Script: `fund_local_account.js`.
- Transfer amount: `1.0 AUR` (configurable via `LOCAL_FUND_AMOUNT`).
- Receiver: `0xbc846dc93595e918a85c43a0a9d973b04cbe1676` (configurable via `LOCAL_FUND_RECEIVER`).
- Note: local-chain assets are for development/testing only and have no external market value.
