import {Connection,PublicKey,Transaction,TransactionInstruction} from '@solana/web3.js';
import {Buffer} from 'buffer';
import bs58 from 'bs58';
import {RPC,GENESIS,MEMO_PROGRAM,receiptFromParsed} from './proof.mjs';
export const connection=new Connection(RPC,{commitment:'confirmed',wsEndpoint:'wss://wss.cookiescan.io',disableRetryOnRateLimit:true});
export async function checkNetwork(){if(await connection.getGenesisHash()!==GENESIS)throw new Error('The RPC returned a different network. No transaction was signed or sent.');}
export function getNightly(){const p=window.nightly?.solana;if(!p)throw new Error('Install Nightly from nightly.app, then reopen this page.');return p;}
export const standardOf=p=>p.features?p:p.standardWallet;
export async function connectNightly(){
  const provider=getNightly();await checkNetwork();
  const wallet=standardOf(provider);
  if(!wallet?.features?.['standard:connect'])throw new Error('This Nightly version does not expose the required wallet connection.');
  const result=await wallet.features['standard:connect'].connect();
  const account=result.accounts?.[0];
  if(!account?.address)throw new Error('Nightly did not return an account.');
  return {provider,wallet,account};
}
export async function disconnectNightly(session){await session?.wallet.features['standard:disconnect']?.disconnect();}
export async function ensureNightlyNetwork(session){
  await checkNetwork();
  if(session.provider.genesisHash!==GENESIS){
    if(typeof session.provider.changeNetwork!=='function')throw new Error('Update Nightly to a version that supports Cookie Chain custom networks.');
    await session.provider.changeNetwork({genesisHash:GENESIS,url:RPC});
    if(session.provider.genesisHash!==GENESIS)throw new Error('Choose Cookie Chain in Nightly, then review the proof again.');
  }
}
export async function prepareProof(session,proof){
  await ensureNightlyNetwork(session);
  const payer=new PublicKey(session.account.address);
  const latest=await connection.getLatestBlockhash('confirmed');
  const transaction=new Transaction({...latest,feePayer:payer}).add(new TransactionInstruction({programId:new PublicKey(MEMO_PROGRAM),keys:[{pubkey:payer,isSigner:true,isWritable:false}],data:Buffer.from(JSON.stringify(proof),'utf8')}));
  const fee=(await connection.getFeeForMessage(transaction.compileMessage(),'confirmed')).value;
  if(fee===null)throw new Error('The network could not estimate a fee. Please try again.');
  const balance=await connection.getBalance(payer,'confirmed');
  if(balance<fee)throw new Error('Your Cookie Chain wallet needs COOK to cover the network fee. See How it works for the official bridge guide.');
  return {transaction,latest,fee,balance,proof,account:session.account.address,preparedAt:Date.now()};
}
export async function signAndPublish(session,review){
  if(!session||!review||session.account.address!==review.account)throw new Error('The wallet account changed or disconnected. Review the proof again.');
  await ensureNightlyNetwork(session);
  if((await connection.getBlockHeight('confirmed'))>review.latest.lastValidBlockHeight)throw new Error('The reviewed transaction expired. Review again to get a fresh fee and blockhash.');
  const feature=session.wallet.features['solana:signTransaction']??session.wallet.features['standard:signTransaction'];
  if(!feature?.signTransaction)throw new Error('Nightly does not expose transaction signing. Update the wallet.');
  const bytes=review.transaction.serialize({requireAllSignatures:false,verifySignatures:false});
  const result=await feature.signTransaction({account:session.account,transaction:new Uint8Array(bytes)});
  if(!result?.[0]?.signedTransaction)throw new Error('Nightly returned no signed transaction.');
  const signed=Transaction.from(result[0].signedTransaction);
  if(!signed.serializeMessage().equals(review.transaction.serializeMessage())||!signed.verifySignatures())throw new Error('The signed transaction differs from the reviewed proof, or its signature is invalid.');
  const signature=bs58.encode(signed.signature);
  // Persist the signature before broadcast so a lost response cannot invite a duplicate.
  savePending({signature,createdAt:Date.now(),lastValidBlockHeight:review.latest.lastValidBlockHeight,...review.proof});
  try{await connection.sendRawTransaction(signed.serialize(),{skipPreflight:false,maxRetries:0,preflightCommitment:'confirmed'});}
  catch(error){throw Object.assign(new Error('Broadcast outcome needs checking. The receipt signature was saved; use Check status before creating another proof.'),{signature,cause:error});}
  return signature;
}
export async function checkStatus(signature,lastValidBlockHeight){
  if(!validSignature(signature))throw new Error('Enter a valid 64-byte transaction signature.');
  await checkNetwork();
  const result=await connection.getSignatureStatuses([signature],{searchTransactionHistory:true});
  const value=result.value[0];
  if(!value&&Number.isSafeInteger(lastValidBlockHeight)&&(await connection.getBlockHeight('finalized'))>lastValidBlockHeight)return 'expired';
  return !value?'unresolved':value.err?'failed':['confirmed','finalized'].includes(value.confirmationStatus)?'confirmed':'pending';
}
export function validSignature(value){try{return typeof value==='string'&&value.length>=80&&value.length<=90&&bs58.decode(value).length===64;}catch{return false;}}
export async function getReceipt(signature){
  if(!validSignature(signature))throw new Error('Enter a valid transaction signature.');
  await checkNetwork();
  const tx=await connection.getParsedTransaction(signature,{commitment:'confirmed',maxSupportedTransactionVersion:0});
  if(!tx)throw new Error('This transaction is not confirmed or is unavailable from the RPC yet.');
  if(tx.meta?.err)throw new Error('This transaction failed on-chain and cannot be used as a receipt.');
  const receipt=receiptFromParsed(tx,signature,data=>new TextDecoder('utf-8',{fatal:true}).decode(bs58.decode(data)));
  if(!receipt)throw new Error('This transaction is not a supported Crumbproof receipt.');
  return receipt;
}
export async function recentReceipts(address){
  await checkNetwork();
  const recent=await connection.getSignaturesForAddress(new PublicKey(address),{limit:20},'confirmed');
  const receipts=[];let unavailable=0;
  for(const item of recent){
    if(item.err)continue;
    try{
      const tx=await connection.getParsedTransaction(item.signature,{commitment:'confirmed',maxSupportedTransactionVersion:0});
      if(!tx){unavailable++;continue;}
      const receipt=receiptFromParsed(tx,item.signature,data=>new TextDecoder('utf-8',{fatal:true}).decode(bs58.decode(data)));
      if(receipt)receipts.push(receipt);
    }catch{unavailable++;}
  }
  return {receipts,checked:recent.length,unavailable};
}
const PENDING_KEY='crumbproof:pending:v1';
export function savePending(item){try{localStorage.setItem(PENDING_KEY,JSON.stringify(item));}catch{throw new Error('Browser storage is unavailable. Nothing was broadcast. Allow local storage before publishing so the pending signature can survive a reload.');}}
export function readPending(){try{const item=JSON.parse(localStorage.getItem(PENDING_KEY));return validSignature(item?.signature)?item:null;}catch{return null;}}
export function clearPending(){try{localStorage.removeItem(PENDING_KEY);}catch{}}
