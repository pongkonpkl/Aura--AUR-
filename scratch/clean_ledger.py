import json
import os

LEDGER_FILE = "ledger.json"

def clean_ledger():
    if not os.path.exists(LEDGER_FILE):
        print("Ledger not found.")
        return

    with open(LEDGER_FILE, 'r', encoding='utf-8-sig') as f:
        ledger = json.load(f)

    def normalize_dict(d):
        new_dict = {}
        for k, v in d.items():
            kl = k.lower()
            if kl in new_dict:
                # Merge logic (assuming atomic units)
                if isinstance(v, str) and v.isdigit():
                    new_dict[kl] = str(int(new_dict[kl]) + int(v))
                else:
                    # For non-numeric, just take the first one found or handle accordingly
                    pass
            else:
                new_dict[kl] = v
        return new_dict

    if "balances" in ledger:
        ledger["balances"] = normalize_dict(ledger["balances"])
    if "staked_balances" in ledger:
        ledger["staked_balances"] = normalize_dict(ledger["staked_balances"])
    if "reward_debts" in ledger:
        ledger["reward_debts"] = normalize_dict(ledger["reward_debts"])
    if "nonces" in ledger:
        # For nonces, we take the MAX nonce found for that user
        new_nonces = {}
        for k, v in ledger["nonces"].items():
            kl = k.lower()
            val = int(v)
            if kl in new_nonces:
                new_nonces[kl] = str(max(int(new_nonces[kl]), val))
            else:
                new_nonces[kl] = str(val)
        ledger["nonces"] = new_nonces

    with open(LEDGER_FILE, 'w', encoding='utf-8') as f:
        json.dump(ledger, f, indent=2)
    
    print("Ledger cleaned and normalized to lowercase.")

if __name__ == "__main__":
    clean_ledger()
