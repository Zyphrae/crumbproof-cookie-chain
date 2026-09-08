export const MAX_FILE_BYTES=50*1024*1024;
export const MAX_LABEL_BYTES=120;
export const MEMO_PROGRAM='MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
export const RPC='https://rpc.cookiescan.io';
export const GENESIS='9wDaBRDgArEUpvhHxGguNkwozsZh4UpGZB9o2EoEcBB2';
export function makeProof(label,sha256){
  const title=String(label).trim();
  if(!title||new TextEncoder().encode(title).length>MAX_LABEL_BYTES||/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(title))throw new Error('Use a public label of 1–120 UTF-8 bytes without control characters.');
  if(typeof sha256!=='string'||!/^[a-f0-9]{64}$/.test(sha256))throw new Error('Choose a file before reviewing its proof.');
  return {app:'crumbproof',v:1,sha256,label:title};
}
export function parseProof(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>420)return null;
  try{const p=JSON.parse(text);if(Object.keys(p).sort().join(',')!=='app,label,sha256,v'||p.app!=='crumbproof'||p.v!==1||typeof p.label!=='string')return null;return makeProof(p.label,p.sha256);}catch{return null;}
}
export async function hashFile(file){
  if(!file||file.size>MAX_FILE_BYTES)throw new Error('Choose a file no larger than 50 MB.');
  const result=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
  return Array.from(new Uint8Array(result),x=>x.toString(16).padStart(2,'0')).join('');
}
export const shorten=(s,n=6)=>s?s.slice(0,n)+'…'+s.slice(-n):'';
export function receiptFromParsed(tx,signature,decodeData){
  if(!tx||!tx.meta||tx.meta.err!==null)return null;
  const message=tx.transaction?.message;
  if(!message||!Array.isArray(message.instructions)||message.instructions.length!==1)return null;
  const first=message.accountKeys?.[0];
  if(!first?.signer)return null;
  const ix=message.instructions[0];
  if(String(ix.programId)!==MEMO_PROGRAM)return null;
  let text;
  try{text=typeof ix.parsed==='string'?ix.parsed:decodeData(ix.data);}catch{return null;}
  const proof=parseProof(text);
  if(!proof)return null;
  return {...proof,signature,signer:String(first.pubkey),slot:tx.slot,blockTime:tx.blockTime??null,fee:tx.meta.fee};
}

