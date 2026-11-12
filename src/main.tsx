import './polyfills';
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { InjectedWallet } from '@near-wallet-selector/core';
import { ArrowUpRight, ArrowRight, Plus, X, Check, Wallet, Gift, Layers, ExternalLink, Upload, ImagePlus, ShieldCheck, Info, LoaderCircle, Copy, CircleHelp, ArrowDownToLine, Send, CheckCircle2, Link as LinkIcon } from 'lucide-react';
import { call, contractId, legacyContractId, selector, view, assertSuccess, verifyTransactions, checkAccounts } from './near';
import { toYocto, fromYocto, makeRecipients, validAccount } from './amounts.mjs';
import './style.css';
import './landing.css';
import './workspace.css';
import { encodeArtwork } from './artwork';
import { confirmedPayout } from './payout.mjs';

type Row = { id: number; account: string; amount: string };
type NFT = { token_id: string; owner_id: string; metadata?: { title?: string; media?: string; description?: string }; contract_id: string; collection_name: string };
type Collection = { account_id: string; name: string; creator_id: string };
type Reward = { balance: string; available: string; weekly_limit: string; spent_this_week: string; resets_at: string; pending: boolean };
type Page = 'create' | 'rewards' | 'guide';
type WalletId = 'meteor-wallet' | 'my-near-wallet';
type Payout = NonNullable<ReturnType<typeof confirmedPayout>>;
const pagePaths: Record<Page,string> = { guide: '/', create: '/create', rewards: '/rewards' };
const pageFromPath = (path: string): Page => path.replace(/\/+$/, '') === '/create' ? 'create' : path.replace(/\/+$/, '') === '/rewards' ? 'rewards' : 'guide';
const money = (value: string) => { const n = Number(fromYocto(value)); return n.toLocaleString(undefined, {maximumFractionDigits: 5}); };
const errorText = (e: unknown) => e instanceof Error ? e.message : String(e);

function RewardArt({small=false}: {small?:boolean}) {
  return <svg className={small?'reward-art small':'reward-art'} viewBox="0 0 400 280" role="img" aria-label="Abstract interlocking green ribbons on a soft lime background"><defs><radialGradient id="bg"><stop stopColor="#e5f4b2"/><stop offset="1" stopColor="#bdd69a"/></radialGradient><linearGradient id="ribbon" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#244d37"/><stop offset=".48" stopColor="#71995a"/><stop offset=".7" stopColor="#173e2a"/><stop offset="1" stopColor="#a3bb73"/></linearGradient><filter id="shadow"><feGaussianBlur stdDeviation="9"/></filter></defs><path fill="url(#bg)" d="M0 0h400v280H0z"/><g opacity=".23" stroke="#6b8852" fill="none"><path d="M0 40h400M0 100h400M0 160h400M0 220h400M40 0v280M100 0v280M160 0v280M220 0v280M280 0v280M340 0v280"/></g><ellipse cx="207" cy="230" rx="95" ry="15" fill="#244d37" opacity=".2" filter="url(#shadow)"/><g transform="translate(200 135) rotate(-32)"><rect x="-95" y="-65" width="135" height="130" rx="52" stroke="url(#ribbon)" strokeWidth="32" fill="none"/><rect x="-10" y="-65" width="110" height="130" rx="48" stroke="url(#ribbon)" strokeWidth="32" fill="none"/><path d="M-26-65h17" stroke="#b8cb8c" strokeWidth="3"/><path d="M43 65h8" stroke="#b8cb8c" strokeWidth="2"/></g><g fill="#31503a"><path d="M36 31v12m-6-6h12M357 236v12m-6-6h12"/><circle cx="357" cy="37" r="3"/></g><text x="25" y="260" fontFamily="monospace" fontSize="9" fill="#436144" letterSpacing="2">PROOF OF CONTRIBUTION</text><text x="348" y="260" fontFamily="monospace" fontSize="9" fill="#436144">001</text></svg>;
}

function LandingPage({onNavigate}:{onNavigate:(page:Page)=>void}) {
  const navigate=(event:React.MouseEvent<HTMLAnchorElement>,page:Page)=>{
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();onNavigate(page);
  };
  return <div className="landing-shell">
    <header className="landing-header"><a className="brand" href="/"><span className="brand-icon">k<span>↗</span></span>keydrop<span className="brand-dot">®</span></a><nav aria-label="Site navigation"><a href="#how-it-works">How it works</a><a href="#contract">On-chain proof</a></nav></header>
    <main className="landing-content">
      <section className="landing-hero">
        <div className="landing-copy"><h1>Good work opens doors<span>.</span></h1><p>Contributor rewards that carry real value. Create and airdrop funded NFTs to ordinary NEAR wallets. The holder can spend within a weekly limit, and access moves with ownership.</p><div className="landing-actions"><a className="primary-button" href="/create" onClick={event=>navigate(event,'create')}>Create an airdrop<ArrowRight size={17}/></a><a className="secondary-button" href="/rewards" onClick={event=>navigate(event,'rewards')}>View my rewards<Gift size={16}/></a></div></div>
        <div className="landing-art"><div className="landing-art-top"><span>KEYDROP / CONTRIBUTOR REWARD</span><span>001 ↗</span></div><RewardArt/><div className="landing-art-bottom"><span>Proof of contribution</span><strong>Ownership unlocks more.</strong></div></div>
      </section>
      <div className="landing-section-heading" id="how-it-works"><h2>How it works</h2></div>
      <div className="guide-grid">{[{icon:Gift,title:'Create a collection',text:'Connect your testnet wallet. Name your collection, add artwork, set funded balances and a weekly limit, then airdrop directly to up to 20 contributor accounts.'},{icon:Wallet,title:'Spend at your pace',text:'The current holder can withdraw NEAR within the weekly allowance. Every token starts its own seven-day window at mint. Unused allowance does not accumulate, and the remaining balance stays in the contract.'},{icon:ShieldCheck,title:'Ownership is the key',text:'Other apps can call has_access(account_id) on the collection contract. Holding any NFT from that collection grants access, even after its balance has been spent. A transfer immediately changes the holder and access.'},{icon:ArrowUpRight,title:'Take it with you',text:'Transfer through the app or any NEP-171 compatible wallet. The remaining balance and weekly usage stay with the NFT. Transferring never resets its allowance.'}].map(item=><section className="panel" key={item.title}><item.icon size={26}/><h2>{item.title}</h2><p>{item.text}</p></section>)}</div>
      <section className="panel contract-info" id="contract"><h2>Built to be verifiable.</h2><p>Each collection has its own NFT contract and on-chain name. Reward contracts have no access keys, balance edits, limit changes, or clawback methods.</p><div><code>{contractId||'Testnet contract not configured'}</code>{contractId&&<a href={`https://testnet.nearblocks.io/address/${contractId}`} target="_blank" rel="noreferrer">Inspect contract<ExternalLink size={14}/></a>}</div></section>
      <footer className="page-footer"><span>Built at NEAR HACKATHON <span className="footer-plus">✳</span> 2026</span></footer>
    </main>
  </div>;
}

function App() {
  const [page,setPage] = useState<Page>(()=>pageFromPath(location.pathname));
  const inApp=page!=='guide';
  const [account,setAccount] = useState('');
  const [notice,setNotice] = useState('');
  const [busy,setBusy] = useState(false);
  const [walletOpen,setWalletOpen] = useState(false);
  const [walletConnecting,setWalletConnecting] = useState<WalletId|null>(null);
  const [walletError,setWalletError] = useState('');
  const [title,setTitle] = useState('Early Contributor');
  const [collectionName,setCollectionName] = useState('');
  const [description,setDescription] = useState('For the people who helped us get here. Thank you for building with us.');
  const [media,setMedia] = useState('');
  const [reference,setReference] = useState('');
  const [localImage,setLocalImage] = useState('');
  const [uploading,setUploading] = useState(false);
  const [amount,setAmount] = useState('10');
  const [weekly,setWeekly] = useState('2');
  const [quote,setQuote] = useState<bigint|null>(null);
  const [rows,setRows] = useState<Row[]>([{id:1,account:'',amount:''},{id:2,account:'',amount:''}]);
  const [review,setReview] = useState(false);
  const [success,setSuccess] = useState<string[]>([]);
  const [latestPayout,setLatestPayout] = useState<Payout|null>(null);
  const [nfts,setNfts] = useState<(NFT & { reward: Reward })[]>([]);
  const [loading,setLoading] = useState(false);
  const [hasAccess,setHasAccess] = useState<boolean|null>(null);
  const [spendAmounts,setSpendAmounts] = useState<Record<string,string>>({});
  const [payoutAccounts,setPayoutAccounts] = useState<Record<string,string>>({});
  const [destinations,setDestinations] = useState<Record<string,string>>({});
  const imageRef = useRef<HTMLInputElement>(null);
  const metadataRef = useRef<HTMLInputElement>(null);
  const nextRow = useRef(3);

  useEffect(() => {
    if (localImage.startsWith('blob:')) return () => URL.revokeObjectURL(localImage);
  }, [localImage]);

  useEffect(() => {
    const syncPage = () => setPage(pageFromPath(location.pathname));
    window.addEventListener('popstate',syncPage);
    return ()=>window.removeEventListener('popstate',syncPage);
  },[]);
  useEffect(()=>{ document.title = `${page==='guide'?'How it works':page==='create'?'Create airdrop':'My rewards'} | Keydrop`; },[page]);
  useEffect(()=>{
    if(!account){setLatestPayout(null);return;}
    try {const saved=localStorage.getItem(`keydrop:payout:${contractId}:${account}`);setLatestPayout(saved?JSON.parse(saved):null);} catch {setLatestPayout(null);}
  },[account]);
  useEffect(() => {
    if (!contractId || !inApp) return;
    let unsubscribe: (()=>void)|undefined;
    let cancelled=false;
    selector().then(s => {
      if(cancelled)return;
      setAccount(s.store.getState().accounts.find(a=>a.active)?.accountId || '');
      const subscription = s.store.observable.subscribe(state=>setAccount(state.accounts.find(a=>a.active)?.accountId || ''));
      unsubscribe=()=>subscription.unsubscribe();
    }).catch(e=>setNotice(errorText(e)));
    return ()=>{cancelled=true;unsubscribe?.();};
  },[inApp]);
  useEffect(()=>{
    const params=new URLSearchParams(location.search);
    if(params.has('errorCode')) { setNotice(params.get('errorMessage') || 'The wallet declined the transaction.'); history.replaceState({},'',location.pathname); }
    const hashes=params.get('transactionHashes');
    if(hashes && account) {
      setBusy(true);
      verifyTransactions(hashes.split(','),account).then(outcomes=>{
        const payout=outcomes.map(outcome=>confirmedPayout(outcome,outcome?.transaction?.receiver_id)).find(Boolean);
        if(payout){rememberPayout(payout);setNotice('NFT payment confirmed on testnet.');}
        else {setSuccess(hashes.split(','));setNotice('Transaction confirmed on testnet.');}
      }).catch(e=>setNotice(errorText(e))).finally(()=>{setBusy(false); history.replaceState({},'',location.pathname);});
    }
  },[account]);
  useEffect(()=>{ if(page==='rewards' && account) void loadRewards(); },[page,account]);
  useEffect(()=>()=>{if(localImage) URL.revokeObjectURL(localImage);},[localImage]);

  async function loadRewards() {
    setLoading(true); setHasAccess(null);
    try {
      const count=Number(await view<string>('collection_count',{}));
      const pages=await Promise.all(Array.from({length:Math.ceil(count/100)},(_,i)=>
        view<Collection[]>('list_collections',{from_index:i*100,limit:100})));
      const collections=[...(legacyContractId?[{account_id:legacyContractId,name:'Keydrop Contributor Rewards',creator_id:''}]:[]),...pages.flat()];
      const groups=await Promise.all(collections.map(async collection=>{
        const [tokens,access]=await Promise.all([
          view<Omit<NFT,'contract_id'|'collection_name'>[]>('nft_tokens_for_owner',{account_id:account,limit:100},collection.account_id),
          view<boolean>('has_access',{account_id:account},collection.account_id),
        ]);
        return {tokens:tokens.map(token=>({...token,contract_id:collection.account_id,collection_name:collection.name})),access};
      }));
      const tokens=groups.flatMap(group=>group.tokens);
      const rewards=await Promise.all(tokens.map(async nft=>({...nft,reward:await view<Reward>('get_reward',{token_id:nft.token_id},nft.contract_id)})));
      setNfts(rewards);setHasAccess(groups.some(group=>group.access));
    } catch(e) {setNotice(errorText(e));} finally {setLoading(false);}
  }
  function rememberPayout(payout:Payout) {
    setLatestPayout(payout);
    try {localStorage.setItem(`keydrop:payout:${contractId}:${payout.senderId}`,JSON.stringify(payout));} catch { /* confirmation still appears in this tab */ }
  }
  function validate() {
    if (!collectionName.trim() || new TextEncoder().encode(collectionName).length>120) throw new Error('Add a collection name (up to 120 bytes).');
    if (!title.trim() || new TextEncoder().encode(title).length>120) throw new Error('Add a reward name (up to 120 bytes).');
    if (!/^https:\/\//.test(media) && !/^ipfs:\/\//.test(media) && !/^data:image\/webp;base64,/.test(media)) throw new Error('Upload your artwork or add a public HTTPS or IPFS image URL.');
    if(reference && !/^https:\/\//.test(reference) && !/^ipfs:\/\//.test(reference)) throw new Error('Metadata reference must be an HTTPS or IPFS URL.');
    if(toYocto(weekly)<=0n) throw new Error('The weekly limit must be greater than zero.');
    if(new TextEncoder().encode(JSON.stringify({title:title.trim(),description,media,reference:reference||null,copies:1})).length>7800) throw new Error('Metadata is too large. Shorten the description or use a public artwork URL.');
    return makeRecipients(rows,amount);
  }
  const filled = rows.filter(r=>r.account.trim());
  let total = 0n; try {total=filled.reduce((n,r)=>n+toYocto(r.amount||amount),0n);} catch { /* form stays editable */ }
  useEffect(()=>{
    if(page!=='create'||!contractId||filled.length<1||total<=0n){setQuote(null);return;}
    let active=true;
    setQuote(null);
    view<string>('get_required',{total_funding:total.toString(),recipient_count:filled.length})
      .then(required=>{if(active)setQuote(BigInt(required));}).catch(()=>{if(active)setQuote(null);});
    return ()=>{active=false;};
  },[page,total.toString(),filled.length]);
  async function mint() {
    setBusy(true);setNotice('');
    try {
      if(!account) throw new Error('Connect your testnet wallet first.');
      const recipients=validate();
      await checkAccounts(recipients.map((r:{account_id:string})=>r.account_id));
      const funding=recipients.reduce((s:bigint,r:{amount:string})=>s+BigInt(r.amount),0n);
      const required=await view<string>('get_required',{total_funding:funding.toString(),recipient_count:recipients.length});
      const outcome=await call('create_collection',{collection_name:collectionName.trim(),metadata:{title:title.trim(),description,media,reference:reference||null,copies:1},weekly_limit:toYocto(weekly).toString(),recipients},required);
      if(!outcome){setReview(false);setNotice('Complete approval in your wallet. We will verify the collection transaction when you return.');return;}
      assertSuccess(outcome);
      setSuccess([outcome.transaction.hash]);setReview(false);setNotice('Airdrop confirmed. Rewards are now in your contributors’ accounts.');
    } catch(e) {setNotice(errorText(e));} finally {setBusy(false);}
  }
  async function transact(method:string,args:object,receiverId=contractId) {
    setBusy(true);setNotice('');
    try {const result=await call(method,args,'1',receiverId);if(!result){setNotice('Complete approval in your wallet. We will verify the transaction when you return.');return;}assertSuccess(result);if(method==='spend' && result.transaction?.hash){const [outcome]=await verifyTransactions([result.transaction.hash],account);const payout=confirmedPayout(outcome,receiverId);if(payout)rememberPayout(payout);setNotice(payout?'NFT payment confirmed on testnet.':'Spend confirmed. Open the transaction to inspect its payment receipt.');}else setNotice('Transaction confirmed.');await loadRewards();}
    catch(e) {setNotice(errorText(e));} finally {setBusy(false);}
  }
  async function spendReward(tokenId:string, rewardContractId:string) {
    try {
      const amt=toYocto(spendAmounts[tokenId]||'0');
      if(amt<=0n) throw new Error('Enter a positive amount.');
      const receiver=(payoutAccounts[tokenId]||'').trim()||account;
      if(!validAccount(receiver)) throw new Error('Enter a valid testnet NEAR account to receive the payment.');
      if(receiver===rewardContractId) throw new Error('Choose a wallet account, not the reward contract.');
      if(receiver!==account) await checkAccounts([receiver]);
      await transact('spend',{token_id:tokenId,amount:amt.toString(),receiver_id:receiver},rewardContractId);
    } catch(e) {setNotice(errorText(e));}
  }
  async function upload(file:File) {
    if(!file.type.startsWith('image/') || file.type==='image/svg+xml') {setNotice('Choose a PNG, JPEG, WebP or GIF image.');return;}
    if(file.size>5*1024*1024) {setNotice('Choose an image smaller than 5 MB.');return;}
    setLocalImage(URL.createObjectURL(file));
    setMedia('');
    const endpoint=import.meta.env.VITE_UPLOAD_URL;
    setUploading(true);
    if(!endpoint){try{setMedia(await encodeArtwork(file));setNotice('Artwork embedded on-chain. It appears in Keydrop, but some wallet galleries cannot display embedded images. For wallet galleries, use a public HTTPS or IPFS artwork URL.');}catch(e){setNotice(errorText(e));}finally{setUploading(false);}return;}
    try {const form=new FormData();form.append('file',file);const response=await fetch(endpoint,{method:'POST',body:form});if(!response.ok)throw new Error('Image upload failed.');const result=await response.json();if(!/^https:\/\//.test(result.url) && !/^ipfs:\/\//.test(result.url))throw new Error('Upload service returned an invalid URL.');setMedia(result.url);setNotice('Image uploaded and ready to mint.');}catch(e){setNotice(errorText(e));}finally{setUploading(false);}
  }
  function removeArtwork() {
    setMedia('');
    setLocalImage('');
    if (imageRef.current) imageRef.current.value = '';
    setNotice('');
  }
  async function importMetadata(file:File) {
    try {if(file.size>8192)throw new Error('Metadata JSON must be smaller than 8 KiB.');const value=JSON.parse(await file.text());if(typeof value.title==='string')setTitle(value.title);if(typeof value.description==='string')setDescription(value.description);if(typeof value.media==='string'){setMedia(value.media);setLocalImage('');}if(typeof value.reference==='string')setReference(value.reference);setNotice('Metadata imported. Review the fields before minting.');}catch(e){setNotice(errorText(e));}
  }
  const changePage=(p:Page)=>{if(location.pathname!==pagePaths[p])history.pushState({},'',pagePaths[p]);setPage(p);setNotice('');window.scrollTo(0,0);};
  const connectWallet=()=>{setWalletError('');setWalletOpen(true);};
  async function chooseWallet(id:WalletId){
    if(!contractId){setWalletError('No testnet contract is configured. See README for setup.');return;}
    setWalletConnecting(id);setWalletError('');
    try{
      const wallet=await(await selector()).wallet<InjectedWallet>(id);
      const accounts=await wallet.signIn({contractId});
      setAccount(accounts[0]?.accountId||'');
      setWalletOpen(false);
    }catch(error){setWalletError(errorText(error));}
    finally{setWalletConnecting(null);}
  }
  const displayMedia=localImage || (media.startsWith('ipfs://')?media.replace('ipfs://','https://ipfs.io/ipfs/'):media);

  if(page==='guide') return <LandingPage onNavigate={changePage}/>;

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="/" onClick={e=>{if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();changePage('guide');}}><span className="brand-icon">k<span>↗</span></span>keydrop<span className="brand-dot">®</span></a>
      <nav aria-label="Main navigation"><button className={page==='create'?'active':''} onClick={()=>changePage('create')}><Plus size={19}/>Create airdrop<span className="nav-shortcut">↗</span></button><button className={page==='rewards'?'active':''} onClick={()=>changePage('rewards')}><Gift size={19}/>My rewards</button></nav>
      <div className="sidebar-bottom"><a href="https://docs.near.org/primitives/nft" target="_blank" rel="noreferrer"><CircleHelp size={16}/>Help & documentation<ArrowUpRight size={14}/></a></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb">Keydrop <span>/</span> <b>{page==='create'?'Create airdrop':'My rewards'}</b></div><div className="top-actions"><span className="testnet"><span className="green-dot"/>NEAR Testnet</span>{account?<button className="wallet-button" onClick={async()=>{await(await(await selector()).wallet()).signOut();setAccount('');setNfts([]);setHasAccess(null);}}><Wallet size={16}/>{account}<span className="disconnect">Disconnect</span></button>:page==='create'?<button className="wallet-button" onClick={connectWallet}><Wallet size={16}/>Connect wallet<ArrowRight size={15}/></button>:null}</div></header>
    <main>
      {notice && <div className="notice" role="status"><Info size={18}/><span>{notice}</span><button aria-label="Dismiss notification" onClick={()=>setNotice('')}><X size={16}/></button></div>}
      {page==='create' && <>
        <div className="page-heading workspace-heading"><div><h1>Create airdrop</h1><p>Design the NFT, set its funded reward, and choose recipients.</p></div></div>
        <div className="create-layout"><div className="editor">
          <section className="panel"><div className="section-title"><div><span className="section-number">01</span><h2>Design NFT</h2></div></div><p className="section-description">Choose artwork and metadata for every NFT in this airdrop.</p>
            <div className="design-fields"><div><label>Reward artwork <span>*</span></label><button className={'upload-zone '+(displayMedia?'has-image':'')} aria-label={displayMedia?'Change artwork':'Upload artwork'} onClick={()=>imageRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(e.dataTransfer.files[0])void upload(e.dataTransfer.files[0]);}}>{displayMedia?<img src={displayMedia} alt="Uploaded reward artwork"/>:<><span className="upload-icon"><ImagePlus size={23}/></span><strong>{uploading?'Uploading…':'Drop your artwork here'}</strong><span>or <u>browse files</u></span><small>PNG, JPG, WebP or GIF · Up to 5 MB</small></>}</button>{(media||localImage)&&<button type="button" className="remove-artwork" disabled={uploading} onClick={removeArtwork}><X size={14}/>Remove image</button>}<input hidden ref={imageRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>{if(e.target.files?.[0])void upload(e.target.files[0]);}}/></div><div className="metadata-fields"><label htmlFor="collection-name">Collection name <span>*</span></label><input id="collection-name" maxLength={120} value={collectionName} onChange={e=>setCollectionName(e.target.value)} placeholder="e.g. Builder Collective"/><div className="label-row"><label htmlFor="title">Reward name <span>*</span></label><button className="text-button" onClick={()=>metadataRef.current?.click()}><Upload size={12}/>Import JSON</button><input hidden ref={metadataRef} type="file" accept=".json,application/json" onChange={e=>{if(e.target.files?.[0])void importMetadata(e.target.files[0]);}}/></div><input id="title" maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Early Contributor"/><label htmlFor="description">Description <span className="optional">Optional</span></label><textarea id="description" rows={3} maxLength={1000} value={description} onChange={e=>setDescription(e.target.value)}/><span className="field-help">A few words to make it personal.</span></div></div>
            <div className="url-field"><label htmlFor="media"><LinkIcon size={13}/>Artwork source <span>*</span></label><input id="media" type="url" value={media} onChange={e=>{setMedia(e.target.value);setLocalImage('');}} placeholder="https://… or ipfs://…"/><small>For wallet galleries, use a public HTTPS or IPFS image URL. Embedded uploads may appear only in Keydrop.</small></div><details className="metadata-extra"><summary>Additional metadata</summary><label htmlFor="reference">Public metadata JSON URL (optional)</label><input id="reference" value={reference} onChange={e=>setReference(e.target.value)} placeholder="ipfs://…/metadata.json"/></details>
          </section>
          <section className="panel"><div className="section-title"><div><span className="section-number">02</span><h2>Fund reward</h2></div></div><p className="section-description">Set the spendable balance and seven-day spending limit.</p><div className="two-columns"><div><label htmlFor="amount">Balance per contributor <span>*</span><Info size={13}/></label><div className="amount-input"><input id="amount" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/><span><b>И</b> NEAR</span></div><small>The spendable reward. Fully funded by you.</small></div><div><label htmlFor="weekly">Weekly spending limit <span>*</span><Info size={13}/></label><div className="amount-input"><input id="weekly" inputMode="decimal" value={weekly} onChange={e=>setWeekly(e.target.value)}/><span><b>И</b> NEAR <em>/ week</em></span></div><small>Available every 7 days. The rest stays locked.</small></div></div><div className="rule-note"><ShieldCheck size={16}/><p>Set once. Enforced on-chain. <span>Balances and limits can’t be changed after minting.</span></p></div></section>
          <section className="panel"><div className="section-title"><div><span className="section-number">03</span><h2>Recipients</h2></div><span className="recipient-count">{filled.length} contributor{filled.length===1?'':'s'}</span></div><p className="section-description">NFTs are minted directly to these NEAR accounts.</p><div className="recipient-table"><div className="table-head"><span>NEAR ACCOUNT ID</span><span>REWARD (NEAR)</span><span/></div>{rows.map((row,i)=><div className="recipient-row" key={row.id}><div className="account-field"><span>{String(i+1).padStart(2,'0')}</span><input aria-label={`Recipient ${i+1} account`} value={row.account} placeholder={i===0?'alice.testnet':'bob.testnet'} onChange={e=>setRows(rows.map(r=>r.id===row.id?{...r,account:e.target.value}:r))}/>{row.account&&validAccount(row.account)&&<Check size={14}/>}</div><input aria-label={`Recipient ${i+1} reward`} inputMode="decimal" value={row.amount} placeholder={amount} onChange={e=>setRows(rows.map(r=>r.id===row.id?{...r,amount:e.target.value}:r))}/><button className="icon-button" aria-label={`Remove recipient ${i+1}`} onClick={()=>setRows(rows.filter(r=>r.id!==row.id))}><X size={15}/></button></div>)}</div><div className="recipient-bottom"><button className="text-button" disabled={rows.length>=20} onClick={()=>setRows([...rows,{id:nextRow.current++,account:'',amount:''}])}><Plus size={15}/>Add contributor</button><span>Up to 20 per airdrop</span></div></section>
        </div><aside className="preview-column"><div className="preview-sticky"><div className="preview-label"><span>NFT preview</span></div><div className="nft-preview"><div className="art-container">{displayMedia?<img src={displayMedia} alt="Reward artwork preview"/>:<RewardArt/>}</div><div className="nft-content"><div className="nft-collection">{collectionName||"YOUR COLLECTION"}<ShieldCheck size={13}/></div><h3>{title||'Your reward name'}</h3><p>{description||'A little recognition for a real contribution.'}</p><div className="nft-values"><div><span>FUNDED BALANCE</span><strong>{amount||'0'} <small>NEAR</small></strong></div><div><span>WEEKLY ALLOWANCE</span><strong>{weekly||'0'} <small>NEAR</small></strong></div></div><div className="nft-footer"><span><Layers size={13}/>NEP-171 NFT</span></div></div></div>
          <div className="summary"><h3>Airdrop summary</h3><div><span>Contributors</span><b>{filled.length.toString().padStart(2,'0')}</b></div><div><span>Total rewards</span><b>{fromYocto(total)} NEAR</b></div><div><span>Collection state + storage allowance <Info size={12}/></span><b>{quote===null?"Calculating...":fromYocto(quote-total)+" NEAR"}</b></div><div className="summary-total"><span>Total to attach</span><strong>{quote===null?"...":fromYocto(quote)} <small>NEAR</small></strong></div><p>Keydrop paid for the shared code once. Your quote covers rewards and collection state; unused storage allowance is refunded. Network gas is additional.</p><button className="primary-button" disabled={busy||uploading||quote===null} onClick={()=>{try{validate();setReview(true);setNotice('');}catch(e){setNotice(errorText(e));}}}>{busy?<LoaderCircle className="spin" size={17}/>:<Send size={16}/>}Review airdrop<ArrowRight size={17}/></button>{!account&&<span className="connect-hint"><Wallet size={12}/>Connect your wallet when you’re ready.</span>}</div></div></aside></div>
        {success.length>0&&<div className="success-box"><CheckCircle2 size={23}/><div><h3>Confirmed on NEAR testnet</h3><p>View the transaction to inspect minted tokens and recipients.</p>{success.map(hash=><a key={hash} href={`https://testnet.nearblocks.io/txns/${hash}`} target="_blank" rel="noreferrer">View transaction<ExternalLink size={14}/></a>)}</div></div>}
      </>}
      {page==='rewards'&&<><div className="page-heading workspace-heading"><div><h1>My rewards</h1><p>View balances, spend, and transfer reward NFTs.</p></div></div>{!account?<div className="empty-state"><Gift size={40}/><h2>Connect your wallet</h2><p>Use the NEAR account that received a reward NFT.</p><button className="primary-button" onClick={connectWallet}><Wallet size={17}/>Connect testnet wallet</button></div>:<><div className="access-strip"><ShieldCheck size={22}/><div><strong>{hasAccess===null?'Checking on-chain access…':hasAccess?'Access verified':'No contributor access'}</strong><p>{account} · {nfts.length} Keydrop NFT{nfts.length===1?"":"s"}</p></div><button className="secondary-button" disabled={loading||busy} onClick={loadRewards}>{loading?<LoaderCircle className="spin" size={15}/>:<Check size={15}/>}Refresh from chain</button></div>{latestPayout&&latestPayout.senderId===account&&<div className="payout-confirmation" role="status"><div><small>Latest NFT payment</small><strong>{latestPayout.receiverId===account?"+":""}{money(latestPayout.amount)} NEAR</strong><p>{latestPayout.receiverId===account?"Received in your wallet":'Sent to '+latestPayout.receiverId} from NFT #{latestPayout.tokenId}</p></div><a href={"https://testnet.nearblocks.io/txns/"+latestPayout.txHash} target="_blank" rel="noreferrer">View on-chain payment <ExternalLink size={14}/></a></div>}{loading?<div className="empty-state"><LoaderCircle className="spin"/>Reading your rewards from testnet…</div>:nfts.length===0?<div className="empty-state"><Gift size={40}/><h2>No rewards here yet.</h2><p>When a project airdrops you a Keydrop NFT, it will appear here.</p></div>:<div className="rewards-grid">{nfts.map(nft=><section className="panel recipient-nft" key={nft.contract_id+':'+nft.token_id}>{nft.metadata?.media?<img className="recipient-art" alt={nft.metadata.title||'Reward NFT'} src={nft.metadata.media.replace('ipfs://','https://ipfs.io/ipfs/')}/>:<RewardArt small/>}<div className="nft-collection">{nft.collection_name} / TOKEN #{nft.token_id}<ShieldCheck size={14}/></div><h2>{nft.metadata?.title||'Contributor Reward'}</h2><p>{nft.metadata?.description}</p><div className="balance-grid"><div><small>Remaining balance</small><strong>{money(nft.reward.balance)} NEAR</strong></div><div><small>Available this week</small><strong>{money(nft.reward.available)} NEAR</strong></div></div><small>Weekly limit: {money(nft.reward.weekly_limit)} NEAR · Resets {new Date(Number(nft.reward.resets_at)).toLocaleString()}</small>{nft.reward.pending&&<p className="pending-note">A transaction is settling. Refresh in a moment.</p>}<label htmlFor={`spend-${nft.token_id}`}>Send NEAR from this NFT</label><div className="inline-form"><input id={`spend-${nft.token_id}`} inputMode="decimal" placeholder="Amount in NEAR" value={spendAmounts[nft.contract_id+":"+nft.token_id]||''} onChange={e=>setSpendAmounts({...spendAmounts,[nft.contract_id+":"+nft.token_id]:e.target.value})}/><button className="secondary-button" disabled={busy||nft.reward.pending} onClick={()=>void spendReward(nft.token_id,nft.contract_id)}><ArrowDownToLine size={16}/>Send</button></div><input className="payout-account" aria-label={`Payment recipient for token ${nft.token_id}`} placeholder={`Recipient account (defaults to ${account})`} value={payoutAccounts[nft.contract_id+":"+nft.token_id]||''} onChange={e=>setPayoutAccounts({...payoutAccounts,[nft.contract_id+":"+nft.token_id]:e.target.value})}/><small>Leave recipient blank to pay your connected wallet. Up to {money(nft.reward.available)} NEAR is available now; excess requests fail on-chain.</small><details><summary>Transfer reward NFT <ArrowUpRight size={14}/></summary><p>Its remaining balance, current allowance and access move to the new holder.</p><div className="inline-form"><input aria-label={`New holder for token ${nft.token_id}`} placeholder="New holder.testnet" value={destinations[nft.contract_id+":"+nft.token_id]||''} onChange={e=>setDestinations({...destinations,[nft.contract_id+":"+nft.token_id]:e.target.value})}/><button className="secondary-button" disabled={busy||nft.reward.pending} onClick={()=>{const receiver=destinations[nft.contract_id+":"+nft.token_id]?.trim();if(!receiver||!validAccount(receiver)||receiver===account){setNotice('Enter a valid different NEAR account ID.');return;}if(window.confirm(`Transfer NFT #${nft.token_id} and its ${money(nft.reward.balance)} NEAR remaining balance to ${receiver}? This cannot be undone.`))void transact('nft_transfer',{token_id:nft.token_id,receiver_id:receiver,memo:'Keydrop reward transfer'},nft.contract_id);}}>Transfer</button></div></details></section>)}</div>}</>}</>}
      <footer className="page-footer"><span>Built at NEAR HACKATHON <span className="footer-plus">✳</span> 2026</span></footer>
    </main></div>
    {review&&<div className="modal-backdrop" onClick={()=>{if(!busy)setReview(false);}}><section className="review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title" onClick={e=>e.stopPropagation()}><button className="modal-close icon-button" aria-label="Close review" disabled={busy} onClick={()=>setReview(false)}><X size={20}/></button><h2 id="review-title">Review airdrop</h2><p>Review carefully. The collection name, balances, and weekly limits cannot change after minting.</p><div className="review-facts"><div><span>Collection</span><b>{collectionName}</b></div><div><span>Reward</span><b>{title}</b></div><div><span>Weekly limit per NFT</span><b>{weekly} NEAR</b></div>{filled.map(r=><div key={r.id}><span>{r.account}</span><b>{r.amount||amount} NEAR</b></div>)}<div><span>Total attached</span><b>{quote===null?"Calculating...":fromYocto(quote)+" NEAR"}</b></div></div>{media.startsWith("data:")&&<p className="artwork-warning">Embedded artwork may be blank in external wallet galleries. Use a public image URL before minting if gallery display matters.</p>}<p className="field-help">Keydrop paid the one-time code cost. You fund rewards and collection state; unused per-token and registry storage allowances are refunded. Gas is additional.</p>{notice&&<div className="review-error" role="alert">{notice}</div>}{account?<button className="primary-button" disabled={busy} onClick={mint}>{busy?<LoaderCircle className="spin" size={18}/>:<Send size={17}/>}Confirm & airdrop<ArrowRight size={17}/></button>:<button className="primary-button" onClick={connectWallet}><Wallet size={18}/>Connect wallet to continue</button>}<span className="connect-hint">Your wallet will ask you to approve the transaction.</span></section></div>}
    {walletOpen&&<div className="modal-backdrop" onClick={()=>{if(!walletConnecting)setWalletOpen(false);}}><section className="review-modal wallet-dialog" role="dialog" aria-modal="true" aria-labelledby="wallet-title" onClick={e=>e.stopPropagation()}><button className="modal-close icon-button" aria-label="Close wallet chooser" disabled={!!walletConnecting} onClick={()=>setWalletOpen(false)} autoFocus><X size={20}/></button><h2 id="wallet-title">Connect a testnet wallet</h2><p>Choose the wallet holding your NEAR testnet account.</p><div className="wallet-options"><button type="button" disabled={!!walletConnecting} onClick={()=>void chooseWallet('meteor-wallet')}><Wallet size={20}/><span><strong>Meteor Wallet</strong><small>Choose testnet in Meteor</small></span>{walletConnecting==='meteor-wallet'?<LoaderCircle className="spin" size={18}/>:<ArrowRight size={17}/>}</button><button type="button" disabled={!!walletConnecting} onClick={()=>void chooseWallet('my-near-wallet')}><Wallet size={20}/><span><strong>MyNearWallet</strong><small>Opens the testnet wallet in a new window</small></span>{walletConnecting==='my-near-wallet'?<LoaderCircle className="spin" size={18}/>:<ArrowRight size={17}/>}</button></div>{walletConnecting&&<p className="wallet-progress" role="status">Complete the connection in {walletConnecting==='meteor-wallet'?'Meteor':'the MyNearWallet window'}.</p>}{walletError&&<p className="review-error" role="alert">{walletError}</p>}<p className="wallet-help">Need a wallet? <a href="https://meteorwallet.app/" target="_blank" rel="noreferrer">Get Meteor<ExternalLink size={12}/></a> or <a href="https://testnet.mynearwallet.com/" target="_blank" rel="noreferrer">open MyNearWallet<ExternalLink size={12}/></a>.</p></section></div>}
  </div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
