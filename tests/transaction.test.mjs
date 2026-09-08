import test from 'node:test';
import assert from 'node:assert/strict';
import {Keypair,Transaction} from '@solana/web3.js';
import bs58 from 'bs58';
import {connection,prepareProof,signAndPublish,checkStatus,recentReceipts,readPending,clearPending} from '../src/chain.mjs';
import {GENESIS,MEMO_PROGRAM,makeProof} from '../src/proof.mjs';
// These are deterministic behavior tests with local signing and mocked RPCs.
// They never submit a chain transaction or claim wallet integration success.
const proof=makeProof('Test fixture','a'.repeat(64));
const signer=Keypair.generate();
const account={address:signer.publicKey.toBase58()};
const blockhash=Keypair.generate().publicKey.toBase58();
function setup(t){
 const store=new Map();
 t.mock.method(connection,'getGenesisHash',async()=>GENESIS);
 t.mock.method(connection,'getLatestBlockhash',async()=>({blockhash,lastValidBlockHeight:100}));
 t.mock.method(connection,'getFeeForMessage',async()=>({value:5000}));
 t.mock.method(connection,'getBalance',async()=>6000);
 t.mock.method(connection,'getBlockHeight',async()=>50);
 t.mock.method(connection,'sendRawTransaction',async()=> 'unused-rpc-signature');
 t.mock.method(connection,'getSignatureStatuses',async()=>({value:[null]}));
 globalThis.localStorage={setItem:(k,v)=>store.set(k,v),getItem:k=>store.get(k)||null,removeItem:k=>store.delete(k)};
 t.after(()=>{delete globalThis.localStorage;});
 const feature={signTransaction:async({transaction})=>{const tx=Transaction.from(transaction);tx.sign(signer);return [{signedTransaction:tx.serialize()}];}};
 return {provider:{genesisHash:GENESIS},wallet:{features:{'solana:signTransaction':feature}},account};
}
test('review contains exactly one Memo, expected signer and fee',async t=>{const s=setup(t),r=await prepareProof(s,proof);assert.equal(r.fee,5000);assert.equal(r.transaction.instructions.length,1);const ix=r.transaction.instructions[0];assert.equal(ix.programId.toBase58(),MEMO_PROGRAM);assert.deepEqual(JSON.parse(ix.data.toString()),proof);assert.equal(ix.keys[0].pubkey.toBase58(),account.address);assert.equal(ix.keys[0].isSigner,true);});
test('wrong RPC genesis blocks signing preparation',async t=>{const s=setup(t);connection.getGenesisHash.mock.mockImplementation(async()=> 'wrong');await assert.rejects(prepareProof(s,proof),/different network/);});
test('insufficient COOK stops before signature',async t=>{const s=setup(t);connection.getBalance.mock.mockImplementation(async()=>4999);await assert.rejects(prepareProof(s,proof),/needs COOK/);});
test('disconnected wallet cannot publish an earlier review',async t=>{const s=setup(t);await assert.rejects(signAndPublish(null,await prepareProof(s,proof)),/disconnected/);assert.equal(connection.sendRawTransaction.mock.callCount(),0);});
test('expired review cannot be signed',async t=>{const s=setup(t),r=await prepareProof(s,proof);connection.getBlockHeight.mock.mockImplementation(async()=>101);await assert.rejects(signAndPublish(s,r),/expired/);assert.equal(connection.sendRawTransaction.mock.callCount(),0);});
test('a changed signed payload is rejected before broadcast',async t=>{const s=setup(t),r=await prepareProof(s,proof);s.wallet.features['solana:signTransaction'].signTransaction=async({transaction})=>{const tx=Transaction.from(transaction);tx.instructions[0].data=Buffer.from(JSON.stringify({...proof,label:'changed'}));tx.sign(signer);return [{signedTransaction:tx.serialize()}];};await assert.rejects(signAndPublish(s,r),/differs/);assert.equal(connection.sendRawTransaction.mock.callCount(),0);});
test('wallet rejection sends nothing',async t=>{const s=setup(t),r=await prepareProof(s,proof);s.wallet.features['solana:signTransaction'].signTransaction=async()=>{throw new Error('User rejected');};await assert.rejects(signAndPublish(s,r),/rejected/);assert.equal(connection.sendRawTransaction.mock.callCount(),0);});
test('storage failure sends nothing',async t=>{const s=setup(t),r=await prepareProof(s,proof);globalThis.localStorage.setItem=()=>{throw new Error('blocked');};await assert.rejects(signAndPublish(s,r),/Nothing was broadcast/);assert.equal(connection.sendRawTransaction.mock.callCount(),0);});
test('signature persists before broadcast; no automatic retries',async t=>{const s=setup(t),r=await prepareProof(s,proof);connection.sendRawTransaction.mock.mockImplementation(async(bytes,options)=>{assert.equal(readPending().signature,bs58.encode(Transaction.from(bytes).signature));assert.equal(options.maxRetries,0);assert.equal(options.skipPreflight,false);});const sig=await signAndPublish(s,r);assert.equal(readPending().signature,sig);assert.equal(readPending().lastValidBlockHeight,100);assert.equal(connection.sendRawTransaction.mock.callCount(),1);});
test('lost broadcast response preserves a checkable signature',async t=>{const s=setup(t),r=await prepareProof(s,proof);connection.sendRawTransaction.mock.mockImplementation(async()=>{throw new Error('network timeout');});await assert.rejects(signAndPublish(s,r),e=>Boolean(e.signature&&readPending().signature===e.signature));assert.equal(connection.sendRawTransaction.mock.callCount(),1);});
test('an absent transaction remains unresolved until expiry',async t=>{setup(t);const sig=bs58.encode(new Uint8Array(64).fill(1));assert.equal(await checkStatus(sig,100),'unresolved');connection.getBlockHeight.mock.mockImplementation(async()=>101);assert.equal(await checkStatus(sig,100),'expired');});
test('chain status distinguishes confirmed from failed',async t=>{setup(t);const sig=bs58.encode(new Uint8Array(64).fill(1));connection.getSignatureStatuses.mock.mockImplementation(async()=>({value:[{err:null,confirmationStatus:'confirmed'}]}));assert.equal(await checkStatus(sig),'confirmed');connection.getSignatureStatuses.mock.mockImplementation(async()=>({value:[{err:{error:'failed'},confirmationStatus:'confirmed'}]}));assert.equal(await checkStatus(sig),'failed');});
test('history reports incomplete RPC reads instead of a false empty result',async t=>{setup(t);t.mock.method(connection,'getSignaturesForAddress',async()=>[{signature:'fixture'}]);t.mock.method(connection,'getParsedTransaction',async()=>{throw new Error('timeout');});const r=await recentReceipts(account.address);assert.equal(r.unavailable,1);assert.equal(r.checked,1);});
