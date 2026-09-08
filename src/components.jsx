import React,{useEffect,useRef,useState} from 'react';
import {File,FileCheck,FileCheck2,ExternalLink,X,CheckCircle2} from 'lucide-react';
export const Mark=()=> <FileCheck size={30} strokeWidth={2}/>;
export function Notice({message}){return message?<div className="notice" role="status">{message}</div>:null;}
export function FilePicker({onChange,selected,hashing,error,label='Drop a file here'}){
 const ref=useRef(),[drag,setDrag]=useState(false);
 const choose=files=>{if(files?.length!==1){if(files?.length)onChange(null,'Choose one file at a time.');return;}onChange(files[0]);};
 return <div className={'dropzone '+(drag?'dragging':'')} onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);choose(e.dataTransfer.files);}}>
  <input ref={ref} type="file" className="file-input" aria-label="Choose local file" onChange={e=>{choose(e.target.files);e.target.value='';}}/>
  {selected?<FileCheck2 size={40}/>:<File size={40}/>}
  <strong>{hashing?'Calculating fingerprint…':selected?selected.name:label}</strong>
  <span>{selected?(selected.size/1024).toLocaleString(undefined,{maximumFractionDigits:1})+' KB · stays on your device':'or choose a file · up to 50 MB'}</span>
  <button className="primary" type="button" onClick={()=>ref.current.click()}>{selected?'Choose another file':'Choose file'}</button>
  {error&&<p className="field-error" role="alert">{error}</p>}
 </div>;
}
export function Explanation(){return <aside><h2>A receipt, not a file upload.</h2><ol className="steps">
 <li><span>01</span><div><h3>Choose your file</h3><p>A fingerprint is calculated in your browser.</p></div></li>
 <li><span>02</span><div><h3>Publish a proof</h3><p>Your wallet signs a receipt on Cookie Chain.</p></div></li>
 <li><span>03</span><div><h3>Share and verify</h3><p>Anyone with the file can check that it matches.</p></div></li>
 </ol></aside>;}
export function ReviewDialog({review,busy,onClose,onPublish}){
 const panel=useRef();
 useEffect(()=>{const previous=document.activeElement;panel.current?.focus();return()=>previous?.focus();},[]);
 const keyDown=e=>{if(e.key==='Escape'&&!busy)onClose();if(e.key==='Tab'){const items=[...panel.current.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled)')];if(!items.length){e.preventDefault();return;}const first=items[0],last=items.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===panel.current)){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===panel.current)){e.preventDefault();first.focus();}}};
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}><section ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="review-title" className="modal" onKeyDown={keyDown}>
 <button className="close" aria-label="Close review" onClick={onClose} disabled={busy}><X/></button>
 <h2 id="review-title">Review your public proof</h2><p>These details become public on Cookie Chain.</p>
 <dl><dt>Public label</dt><dd>{review.proof.label}</dd><dt>Wallet</dt><dd className="mono">{review.account}</dd><dt>SHA-256 fingerprint</dt><dd className="mono">{review.proof.sha256}</dd><dt>Estimated network fee</dt><dd>{(review.fee/1e9).toLocaleString(undefined,{maximumFractionDigits:9})} COOK</dd></dl>
 <p className="muted">Your file will not be uploaded. This transaction records a receipt and pays the network fee; it transfers no tokens to another recipient.</p>
 <button className="primary" disabled={busy} onClick={onPublish}>{busy?'Waiting for Nightly…':'Publish with Nightly'}</button>
 </section></div>;
}
export function Receipt({receipt}){
 const [copy,setCopy]=useState('');
 const url=location.origin+location.pathname+'?tx='+encodeURIComponent(receipt.signature);
 return <section className="receipt"><div className="receipt-title"><CheckCircle2 size={24}/><h2>Proof confirmed</h2></div>
 <p className="receipt-label">{receipt.label}</p><dl><dt>Recorded by</dt><dd className="mono">{receipt.signer}</dd><dt>Recorded at</dt><dd>{receipt.blockTime?new Date(receipt.blockTime*1000).toLocaleString()+' · block time':'Block time unavailable'} · slot {receipt.slot?.toLocaleString()}</dd><dt>File fingerprint</dt><dd className="mono">{receipt.sha256}</dd></dl>
 <div className="actions"><button className="primary" onClick={async()=>{try{await navigator.clipboard.writeText(url);setCopy('Link copied');}catch{setCopy('Copy the link below');}}}>{copy||'Copy proof link'}</button><a className="text-link" href={'https://cookiescan.io/tx/'+receipt.signature} target="_blank" rel="noreferrer">View transaction <ExternalLink size={16}/></a></div>
 <a className="mono share-link" href={url}>{url}</a><p className="muted">This records a wallet's file fingerprint. It does not establish authorship, quality, delivery acceptance or payment.</p>
 </section>;
}
export function Help(){return <section className="panel help"><h2>How Crumbproof works</h2><p>Your browser calculates a SHA-256 fingerprint of a file. Nightly signs one Memo program instruction on Cookie Chain containing the fingerprint and your public label. Anyone who has the exact file can hash it again and compare it with the confirmed receipt.</p>
 <h3>Set up Nightly</h3><p>Install the wallet from <a href="https://nightly.app" target="_blank" rel="noreferrer">nightly.app</a>. Use its Cookie Chain network or add the custom RPC <code>https://rpc.cookiescan.io</code>. The app asks Nightly to switch to the verified Cookie Chain genesis before signing.</p>
 <h3>Network fees</h3><p>You need a little COOK in your Cookie Chain wallet. Follow the <a href="https://docs.cookiechain.wtf/bridge" target="_blank" rel="noreferrer">official bridge guide</a> if you choose to fund it. Review bridge details and the network fee in your own wallet. Crumbproof charges no application fee.</p>
 <h3>What stays private</h3><p>The file contents and filename stay on your device. The label, wallet address and fingerprint are public and cannot be removed from the blockchain. Avoid confidential labels. Low-entropy or already-public files may be recognizable from their fingerprints.</p>
 <h3>What a receipt establishes</h3><p>A receipt shows that a wallet recorded this fingerprint at a block and, when available, its block time. It does not establish copyright ownership, that a client accepted a deliverable, or that someone paid. Keeping the file remains your responsibility.</p>
 <h3>If a transaction takes too long</h3><p>Keep its signature and use Check status. A timeout or lost broadcast response does not prove failure. The app preserves the pending signature in this browser so you can investigate before publishing again.</p></section>;}
