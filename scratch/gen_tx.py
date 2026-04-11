from eth_account import Account
from eth_account.messages import encode_defunct
import json

# Setup
mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
Account.enable_unaudited_hdwallet_features()
acc = Account.from_mnemonic(mnemonic)
from_address = acc.address # Use the generated address
to_address = "0x0aa81E8DAf1Ef9e9A2A62B043bFE9323b71BF253"
amount_atom = 1000000000000000000 # 1 AUR
nonce = 1

# Message format: AUR_TX:{nonce}:{from}:{to}:{amount}
message_str = f"AUR_TX:{nonce}:{from_address}:{to_address}:{amount_atom}"
message = encode_defunct(text=message_str)
signature = acc.sign_message(message).signature.hex()

payload = {
    "op": "transfer",
    "tx": {
        "from_address": from_address,
        "to_address": to_address,
        "amount_atom": str(amount_atom),
        "nonce": nonce
    },
    "signature": signature
}

print(json.dumps(payload))
