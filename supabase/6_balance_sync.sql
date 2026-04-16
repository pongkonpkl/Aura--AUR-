-- Professional Balance Correction
-- Updating the dashboard balance to match the real on-chain deposit of 0.0001 ETH
UPDATE profiles 
SET eth_balance = 0.0001 
WHERE wallet_address = LOWER('0xDEF092AF8138Db03e83664DF86ddDbF2AcB2F134');
