# Security Guidelines for Aura Sovereign Wallet

This document outlines the mandatory security standards and best practices for the Aura ($AUR) Sovereign ecosystem.

## 1. Seed Phrase Management
- **Offline Storage**: Write your 12-word seed phrase on paper or metal. Never store it in a digital file, cloud storage, or take a photo of it.
- **Verification**: Always perform a test recovery to ensure your seed phrase is correct and leads to the intended wallet address.
- **Redundancy**: Keep at least two physical copies in separate secure locations.

## 2. Local & Device Security
- **Strong PIN/Password**: Avoid easily guessable combinations (birthdays, 1234, etc.).
- **Auto-Lock**: The wallet is configured to return to the PIN entry screen after a period of inactivity.
- **Log Hygiene**: Ensure that mnemonics and private keys are never printed in application logs.

## 3. Cloud & Database (Supabase)
- **Row Level Security (RLS)**: Enforced at the database level to ensure users can only access their own data.
- **Sensitive Data**: Avoid storing plaintext sensitive data in the database. Use encryption where necessary.

## 4. Source Code & GitHub
- **Environment Files**: `.env` and `.env.local` are strictly excluded via `.gitignore`.
- **Secret Scanning**: GitHub Secret Scanning is enabled to detect accidental leaks.
- **No Hardcoded Secrets**: Periodic audits are performed to ensure no private keys or mnemonics exist in the codebase.

## 5. Transaction Safety
- **Double Confirmation**: All critical operations (Send, Stake, Unstake, Claim) require manual confirmation via a popup audit.
- **Digital Signatures**: Every transaction is cryptographically signed using the EIP-191 standard with nonce protection.

## 6. Advanced Protections
- **Cold Storage**: For large holdings, users are encouraged to use hardware wallets (Ledger, Trezor).
- **Regular Audits**: Continuous vulnerability scanning and dependency updates.

---

**Remember**: In a sovereign ecosystem, you are your own bank. Security is a continuous process, not a one-time setup.
