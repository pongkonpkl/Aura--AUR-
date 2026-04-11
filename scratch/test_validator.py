import subprocess
import json

payload = {
    "op": "transfer", 
    "tx": {
        "from_address": "0x9858EfFD232B4033E47d90003D41EC34EcaEda94", 
        "to_address": "0x0aa81E8DAf1Ef9e9A2A62B043bFE9323b71BF253", 
        "amount_atom": "1000000000000000000", 
        "nonce": 1
    }, 
    "signature": "e3c47503c7d7a01f42c276e85acb4f89486d918c0f3627f907bfdd77a6044ec32ff402ce47f055a21e3b39e596ac37a707f2ab78f6074c544e96fbdcfb637d9a1c"
}

payload_str = json.dumps(payload)
result = subprocess.run(["python", "cloud_validator.py", payload_str], capture_output=True, text=True)

print("STDOUT:", result.stdout)
print("STDERR:", result.stderr)
