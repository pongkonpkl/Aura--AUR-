// Infinity Bridge — Dharma x Cross-chain (Event Listener)
import { EventEmitter } from "events";

const bridge = new EventEmitter();

// Setup listener for the smart contract event
bridge.on("CrossChainSend", ({ payloadHash, dstChain }) => {
    console.log(`Relaying to chain: ${dstChain} - Hash: ${payloadHash}`);
    relayToChain(dstChain, payloadHash);
});

function relayToChain(chain: string, payloadHash: string) {
  // Logic to execute bridge contract on dest chain (e.g. LayerZero, Axelar)
  console.log(`Relay Tx executed on ${chain} for ${payloadHash}`);
}

export function simulateEvent(payloadHash: string, dstChain: string) {
  bridge.emit("CrossChainSend", { payloadHash, dstChain });
}
