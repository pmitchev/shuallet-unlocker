// params.js
const B_PROTOCOL_ADDRESS = '19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut';
const MAP_PROTOCOL_ADDRESS = '1PuQa7K62MiKCtssSLKy1kh56WWU7MtUR5';
const AIP_PROTOCOL_ADDRESS = '15PciHG22SNLQJXMoSUaWVi7WSqc7hCfva';
const BAP_PROTOCOL_ADDRESS = '1BAPSuaPnfGnSBM3GLV9yhxUdYe4vGbdMT';
const BPP_PROTOCOL_ADDRESS = 'BPP';
const P2PKH_SIGSCRIPT_SIZE = 1 + 73 + 1 + 33;
const P2PKH_OUTPUT_SIZE = 8 + 1 + 1 + 1 + 1 + 20 + 1 + 1;
const P2PKH_INPUT_SIZE = 36 + 1 + P2PKH_SIGSCRIPT_SIZE + 4;
const PUB_KEY_SIZE = 66;
const FEE_PER_KB = 1;
const FEE_FACTOR = (FEE_PER_KB / 1000); // 1 satoshi per Kilobyte
const SIGHASH_ALL_FORKID = bsv.crypto.Signature.SIGHASH_ALL | bsv.crypto.Signature.SIGHASH_FORKID;
const SIGHASH_SINGLE_ANYONECANPAY_FORKID = bsv.crypto.Signature.SIGHASH_SINGLE | bsv.crypto.Signature.SIGHASH_ANYONECANPAY | bsv.crypto.Signature.SIGHASH_FORKID;
const SIGHASH_ALL_ANYONECANPAY_FORKID = bsv.crypto.Signature.SIGHASH_ALL | bsv.crypto.Signature.SIGHASH_ANYONECANPAY | bsv.crypto.Signature.SIGHASH_FORKID;

// helpers.js
const base64ToArrayBuffer = base64 => {
    const binary_string = atob(base64);
    const bytes = new Uint8Array(binary_string.length);
    for (let i = 0; i < binary_string.length; i++)  { bytes[i] = binary_string.charCodeAt(i) }
    return bytes;
}
const getScriptPushData = data => {
    const b64 = btoa(data);
    const abuf = base64ToArrayBuffer(b64);
    return dataToBuf(abuf);
}
const base64ToHex = str => {
    const raw = atob(str);
    let result = '';
    for (let i = 0; i < raw.length; i++) {
      const hex = raw.charCodeAt(i).toString(16);
      result += (hex.length === 2 ? hex : '0' + hex);
    }
    return result;
}
const sleep = timeout => { return new Promise(resolve => setTimeout(resolve, timeout)) }

// idb.js
var idb = indexedDB || mozIndexedDB || webkitIndexedDB || msIndexedDB;
const initSHUAlletDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('shuallet');
        request.onupgradeneeded = e => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('utxos')) {
                db.createObjectStore('utxos', { keyPath: 'output' });
            }
            if (!db.objectStoreNames.contains('txs')) {
                let txs = db.createObjectStore('txs', { keyPath: 'txid' });
                // txs.createIndex('height_idx', 'height');
            }
            console.log(`upgrading to version ${e.newVersion}`);
        }
        request.onsuccess = e => { resolve(e.target.result) }
        request.onerror = e => {
            console.log('error', e);
            alert(e.target.error)
            reject(e);
        }
    })
}
initSHUAlletDB();
const addUTXO = utxo => {
    if (idb) {
        const request = indexedDB.open('shuallet');
        request.onsuccess = e => {
            console.log('adding utxo...');
            let db = e.target.result;
            const tx = db.transaction('utxos', 'readwrite');
            const table = tx.objectStore('utxos');
            utxo.output = `${utxo.txid}_${utxo.vout}`;
            table.add(utxo);
        }
        request.onerror = e => { console.log('error', e) }
    }
}
const cachedUtxos = cb => {
    if (idb) {
        const request = indexedDB.open('shuallet');
        request.onsuccess = e => {
            db = e.target.result;
            const tx = db.transaction('utxos', 'readonly');
            const table = tx.objectStore('utxos');
            const utxos = table.getAll();
            utxos.onsuccess = e => {
                const utxos = e.target.result;
                return cb(utxos);
            }
        }
        request.onerror = e => { console.log('error', e) }
    } else { cb([]) }
}
const getCachedUTXOs = () => {
    return new Promise((resolve, reject) => { cachedUtxos(utxos => { utxos.length ? resolve(utxos) : resolve([]) }) })
}
const removeUtxo = (output, cb) => {
    if (idb) {
        const request = indexedDB.open('shuallet');
        request.onsuccess = e => {
            db = e.target.result;
            const tx = db.transaction('utxos', 'readwrite');
            const table = tx.objectStore('utxos');
            const utxos = table.delete(output);
            utxos.onsuccess = e => {
                const utxo = e;
                return cb(utxo);
            }
        }
        request.onerror = e => { console.log('error', e) }
    }
}
const deleteUTXO = output => {
    return new Promise((resolve, reject) => { removeUtxo(output, utxo => { utxo ? resolve(utxo) : resolve({}) }) })
}
const clearUTXOs = utxos => {
    if (idb) {
        const request = indexedDB.open('shuallet');
        request.onsuccess = e => {
            let db = e.target.result;
            const tx = db.transaction('utxos', 'readwrite');
            const store = tx.objectStore('utxos');
            const reqDelete = store.clear();
            reqDelete.onsuccess = e => {
                console.log("UTXO cache cleared.", e);
                utxos?.forEach(u => addUTXO(u))
            }
        }
        request.onerror = e => { console.log('error', e) }
    }
}

const addTx = txо => {
    if (idb) {
        const request = indexedDB.open('shuallet');
        request.onsuccess = e => {
            console.log('adding tx...');
            let db = e.target.result;
            const tx = db.transaction('txs', 'readwrite');
            const table = tx.objectStore('txs');
            table.add(txо);
        }
        request.onerror = e => { console.log('error', e) }
    }
}
const cachedTxs = (height, cb) => {
    if (idb) {
        const request = indexedDB.open('shuallet');
        request.onsuccess = e => {
            db = e.target.result;
            const txs = db.transaction('txs', 'readonly');
            const table = txs.objectStore('txs');
            const heightIndex = table.index("height_idx");
            const txs_records = heightIndex.getAll(IDBKeyRange.upperBound(height));
            txs_records.onsuccess = e => {
                const records = e.target.result;
                return cb(records);
            }
        }
        request.onerror = e => { console.log('error', e) }
    } else { cb([]) }
}
const getCachedTxs = (height) => {
    return new Promise((resolve, reject) => { cachedTxs(height, txs => { txs.length ? resolve(txs) : resolve([]) }) })
}
const removeTx = (txid, cb) => {
    if (idb) {
        const request = indexedDB.open('shuallet');
        request.onsuccess = e => {
            db = e.target.result;
            const tx = db.transaction('txs', 'readwrite');
            const table = tx.objectStore('txs');
            const txs = table.delete(txid);
            txs.onsuccess = e => {
                const tx_ = e;
                return cb(tx_);
            }
        }
        request.onerror = e => { console.log('error', e) }
    }
}
const deleteTx = txid => {
    return new Promise((resolve, reject) => { removeTx(txid, tx => { tx ? resolve(tx) : resolve({}) }) })
}
const clearTxs = txs => {
    if (idb) {
        const request = indexedDB.open('shuallet');
        request.onsuccess = e => {
            let db = e.target.result;
            console.log('success');
            const tx = db.transaction('txs', 'readwrite');
            const store = tx.objectStore('txs');
            const reqDelete = store.clear();
            reqDelete.onsuccess = e => {
                console.log("Tx cache cleared.", e);
                txs?.forEach(t => addTx(t))
            }
        }
        request.onerror = e => { console.log('error', e) }
    }
}

// api.js
const getAddressFromPaymail = async paymail => {
    const r = await fetch(`https://api.polynym.io/getAddress/${paymail}`);
    const { address } = await r.json();
    return address;
}
const getBlock = async() => {
    const r = await fetch(`https://api.whatsonchain.com/v1/bsv/main/chain/info`);
    const res = await r.json();
    return res?.blocks;
}
const bufferToHex = buffer => {
    return [...new Uint8Array (buffer)].map (b => b.toString (16).padStart (2, "0")).join ("");
}
const btRawtx = async txid => {
    const r = await fetch(`https://api.bitails.io/download/tx/${txid}`);
    const res = await r.arrayBuffer();
    return [...new Uint8Array (res)].map (b => b.toString (16).padStart (2, "0")).join ("");
}
const getRawtx = async txid => {
    const r = await fetch(`https://api.whatsonchain.com/v1/bsv/main/tx/${txid}/hex`);
    const raw = await r.text();
    return raw;
}
const broadcast = async(txhex, cacheUTXOs = false, address = null) => {
    const r = await (await fetch(`https://api.whatsonchain.com/v1/bsv/main/tx/raw`, {
        method: 'post',
        body: JSON.stringify({ txhex })
    })).json();
    if (r && r?.length === 64 && cacheUTXOs && address !== null) {
        const sp = spent(txhex);
        const utxos = extractUTXOs(txhex, address);
        console.log('Deleting spent UTXOs....', sp);
        sp.forEach(utxo => { deleteUTXO(`${utxo.txid}_${utxo.vout}`) })
        utxos.forEach(utxo => addUTXO(utxo))
    }
    initWallet()
    return r;
}

//localstorage
const addUnlockedTx = (txid) => {
    let unlockedTxs = listUnlockedTxs();
    unlockedTxs.unshift(txid)
    localStorage.setItem('unlockedTxs', JSON.stringify(unlockedTxs));
}

const listUnlockedTxs = () => {
    return JSON.parse(localStorage.getItem('unlockedTxs') || "[]");
}
const deleteDB = () => {
    indexedDB.deleteDatabase('shuallet')
}

//bHelpers.js
const signPayload = (data, pkWIF, isLike = false) => {
    const arrops = data.getOps('utf8');
    let hexarrops = [];
    hexarrops.push('6a');
    if (isLike) { hexarrops.push('6a') }
    arrops.forEach(o => { hexarrops.push(str2Hex(o)) })
    if (isLike) { hexarrops.push('7c') }
    let hexarr = [], payload = [];
    if (pkWIF) {
        const b2sign = hexArrayToBSVBuf(hexarrops);
        const bsvPrivateKey = bsv.PrivateKey.fromWIF(pkWIF);
        const signature = bsvMessage.sign(b2sign.toString(), bsvPrivateKey);
        const address = bsvPrivateKey.toAddress().toString();
        payload = arrops.concat(['|', AIP_PROTOCOL_ADDRESS, 'BITCOIN_ECDSA', address, signature]);
    } else { payload = arrops }
    payload.forEach(p => { hexarr.push(str2Hex(p)) })
    return payload;
}
const str2Hex = str => {
    hex = unescape(encodeURIComponent(str)).split('').map(v => {return v.charCodeAt(0).toString(16).padStart(2,'0')}).join('');
    return hex;
}
const hex2Str = hex => {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
        let v = parseInt(hex.substr(i, 2), 16);
        if (v) str += String.fromCharCode(v);
    }
    return str; 
}
const hexArrayToBSVBuf = arr => {
    const hexBuf = arrToBuf(arr);
    const decoded = new TextDecoder().decode(hexBuf);
    const str2sign = hex2Str(decoded);
    const abuf = strToArrayBuffer(str2sign);
    const bsvBuf = dataToBuf(abuf);
    return bsvBuf;
}
const arrToBuf = arr => {
    const msgUint8 = new TextEncoder().encode(arr);
    const decoded = new TextDecoder().decode(msgUint8);
    const value = decoded.replaceAll(',', '');
    return new TextEncoder().encode(value);
}
const strToArrayBuffer = binary_string => {
    const bytes = new Uint8Array( binary_string.length );
    for (let i = 0; i < binary_string.length; i++)  {bytes[i] = binary_string.charCodeAt(i) }
    return bytes;
}
const dataToBuf = arr => {
    const bufferWriter = bsv.encoding.BufferWriter();
    arr.forEach(a => { bufferWriter.writeUInt8(a) });
    return bufferWriter.toBuffer();
}
const getUTXO = (rawtx, idx) => {
    const bsvtx = new bsv.Transaction(rawtx);
    return {
        satoshis: bsvtx.outputs[idx].satoshis,
        vout: idx,
        txid: bsvtx.hash,
        script: bsvtx.outputs[idx].script.toHex()
    }
}
const getBSVPublicKey = pk => { return bsv.PublicKey.fromPrivateKey(bsv.PrivateKey.fromWIF(pk)) }
const getAddressFromPrivateKey = pk => { return bsv.PrivateKey.fromWIF(pk).toAddress().toString() }
const bPost = (rawtx, post, replyTxid, signPkWIF) => {
    const bsvtx = bsv.Transaction(rawtx);
    const p = replyTxid ? bSocial.reply(replyTxid) : bSocial.post();
    p.addText(post);
    const payload = signPkWIF ? signPayload(p, signPkWIF) : p.getOps('utf8');
    bsvtx.addSafeData(payload);
    return bsvtx.toString();
}
const bLike = (rawtx, likeTxid, emoji, signPkWIF) => {
    const bsvtx = bsv.Transaction(rawtx);
    const l = bSocial.like(likeTxid, emoji || '');
    const payload = signPkWIF ? signPayload(l, signPkWIF, true) : l.getOps('utf8');
    bsvtx.addSafeData(payload);
    return bsvtx.toString();
}

// bSocial.js
class BSocial {
    constructor(appName) {
      if (!appName) throw new Error('App name needs to be set');
      this.appName = appName;
    }
  
    post() {
      return new BSocialPost(this.appName);
    }
  
    repost(txId) {
      const post = new BSocialPost(this.appName);
      post.setType('repost');
      post.setTxId(txId);
      return post;
    }
  
    reply(txId) {
      const post = new BSocialPost(this.appName);
      post.setTxId(txId);
      return post;
    }
  
    paywall(paywallMessage, paywallKey, paywallPayouts, paywallServer, paywallCurrency = 'USD') {
      // This will throw if the key is not valid
      const privateKey = bsv.PrivateKey.fromWIF(paywallKey);
  
      const post = new BSocialPost(this.appName);
      post.setPaywall(paywallMessage, privateKey, paywallPayouts, paywallServer, paywallCurrency);
  
      return post;
    }
  
    like(txId, emoji = '') {
      const like = new BSocialLike(this.appName);
      like.setTxId(txId);
      if (emoji) {
        like.setEmoji(emoji);
      }
  
      return like;
    }
  
    tip(txId, amount = 0, currency = 'USD') {
      const tip = new BSocialTip(this.appName);
      tip.setTxId(txId);
      if (amount && currency) {
        tip.setAmount(amount, currency);
      }
  
      return tip;
    }
  
    follow(idKey) {
      const follow = new BSocialFollow(this.appName);
      follow.setIdKey(idKey);
  
      return follow;
    }
  
    unfollow(idKey) {
      const follow = new BSocialFollow(this.appName);
      follow.setIdKey(idKey);
  
      follow.setAction('unfollow');
  
      return follow;
    }
}

// bSocialLike.js
class BSocialLike {
    constructor(appName) {
      if (!appName) throw new Error('App name needs to be set');
      this.appName = appName;
      this.txId = '';
      this.emoji = '';
    }
  
    setTxId(txId) {
      this.txId = txId;
    }
  
    setEmoji(emoji) {
      if (typeof emoji !== 'string' || !emoji.match(/\p{Emoji}/gu)) {
        throw new Error('Invalid emoji');
      }
      this.emoji = emoji;
    }
  
    getOps(format = 'hex') {
      if (!this.txId) throw new Error('Like is not referencing a valid transaction');
  
      const ops = [];
      ops.push(MAP_PROTOCOL_ADDRESS); // MAP
      ops.push('SET');
      ops.push('app');
      ops.push(this.appName);
      ops.push('type');
      ops.push('like');
      ops.push('tx');
      ops.push(this.txId);
  
      if (this.emoji) {
        ops.push('emoji');
        ops.push(this.emoji);
      }
  
      return ops.map(op => {
        return op.toString(format);
      });
    }
}

// bSocialPost
class BSocialPost {
    constructor(appName) {
      if (!appName) throw new Error('App name needs to be set');
      this.appName = appName;
      this.type = 'post';
      this.txId = '';
  
      this.texts = [];
      this.images = [];
  
      this.extraMapData = {};
    }
  
    setType(type) {
      this.type = type;
    }
  
    setTxId(txId) {
      this.txId = txId;
    }
  
    addMapData(key, value) {
      if (typeof key !== 'string' || typeof value !== 'string') {
        throw new Error('Key and value should be a string');
      }
      this.extraMapData[key] = value;
    }
  
    addText(text, type = 'text/markdown') {
      if (typeof text !== 'string') throw new Error('Text should be a string');
  
      this.texts.push({
        text,
        type,
      });
    }
  
    addMarkdown(markdown) {
      this.addText(markdown);
    }
  
    addImage(dataUrl) {
      const image = dataUrl.split(',');
      const meta = image[0].split(';');
      const type = meta[0].split(':');
  
      if (type[0] !== 'data' || meta[1] !== 'base64' || !type[1].match('image/')) {
        throw new Error('Invalid image dataUrl format');
      }
  
      const img = atob(image[1]);
      this.images.push({
        content: img,
        type: type[1],
      });
    }
  
    getOps(format = 'hex') {
      // check for texts or images content
      const hasContent = this.texts.length > 0 || this.images.length > 0;
      const isRepost = this.type === 'repost' && this.txId;
      if (!hasContent && !isRepost) {
        throw new Error('There is no content for this post');
      }
  
      const ops = [];
  
      if (this.texts.length > 0) {
        this.texts.forEach((t) => {
          ops.push(B_PROTOCOL_ADDRESS); // B
          ops.push(t.text);
          ops.push(t.type);
          ops.push('UTF-8');
          ops.push('|');
        });
      }
  
      if (this.images.length > 0) {
        this.images.forEach((image) => {
          // image.content is in dataUrl format
          ops.push(B_PROTOCOL_ADDRESS); // B
          ops.push(image.content);
          ops.push(image.type);
          ops.push('|');
        });
      }
  
      ops.push(MAP_PROTOCOL_ADDRESS); // MAP
      ops.push('SET');
      ops.push('app');
      ops.push(this.appName);
      ops.push('type');
      ops.push(this.type);
  
      if (this.txId) {
        // reply
        if (this.type !== 'repost') {
          // a repost does not need the context set
          ops.push('context');
          ops.push('tx');
        }
        ops.push('tx');
        ops.push(this.txId);
      }
  
      const extraMapData = Object.keys(this.extraMapData);
      if (extraMapData.length) {
        extraMapData.forEach((key) => {
          ops.push(key);
          ops.push(this.extraMapData[key]);
        });
      }
  
      return ops.map(op => {
        return op.toString(format);
      });
    }
}

// bsv-lock.js
const LOCKUP_PREFIX = `97dfd76851bf465e8f715593b217714858bbe9570ff3bd5e33840a34e20ff026 02ba79df5f8ae7604a9830f03c7933028186aede0675a16f025dc4f8be8eec0382 1008ce7480da41702918d1ec8e6849ba32b4d65b1e40dc669c31a1e6306b266c 0 0`;
const LOCKUP_PREFIX_CHECK = `2097dfd76851bf465e8f715593b217714858bbe9570ff3bd5e33840a34e20ff0262102ba79df5f8ae7604a9830f03c7933028186aede0675a16f025dc4f8be8eec0382201008ce7480da41702918d1ec8e6849ba32b4d65b1e40dc669c31a1e6306b266c0000`;
const LOCKUP_SUFFIX = `OP_NOP 0 OP_PICK 0065cd1d OP_LESSTHAN OP_VERIFY 0 OP_PICK OP_4 OP_ROLL OP_DROP OP_3 OP_ROLL OP_3 OP_ROLL OP_3 OP_ROLL OP_1 OP_PICK OP_3 OP_ROLL OP_DROP OP_2 OP_ROLL OP_2 OP_ROLL OP_DROP OP_DROP OP_NOP OP_5 OP_PICK 41 OP_NOP OP_1 OP_PICK OP_7 OP_PICK OP_7 OP_PICK 0ac407f0e4bd44bfc207355a778b046225a7068fc59ee7eda43ad905aadbffc800 6c266b30e6a1319c66dc401e5bd6b432ba49688eecd118297041da8074ce0810 OP_9 OP_PICK OP_6 OP_PICK OP_NOP OP_6 OP_PICK OP_HASH256 0 OP_PICK OP_NOP 0 OP_PICK OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT 00 OP_CAT OP_BIN2NUM OP_1 OP_ROLL OP_DROP OP_NOP OP_7 OP_PICK OP_6 OP_PICK OP_6 OP_PICK OP_6 OP_PICK OP_6 OP_PICK OP_NOP OP_3 OP_PICK OP_6 OP_PICK OP_4 OP_PICK OP_7 OP_PICK OP_MUL OP_ADD OP_MUL 414136d08c5ed2bf3ba048afe6dcaebafeffffffffffffffffffffffffffffff00 OP_1 OP_PICK OP_1 OP_PICK OP_NOP OP_1 OP_PICK OP_1 OP_PICK OP_MOD 0 OP_PICK 0 OP_LESSTHAN OP_IF 0 OP_PICK OP_2 OP_PICK OP_ADD OP_ELSE 0 OP_PICK OP_ENDIF OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_NOP OP_2 OP_ROLL OP_DROP OP_1 OP_ROLL OP_1 OP_PICK OP_1 OP_PICK OP_2 OP_DIV OP_GREATERTHAN OP_IF 0 OP_PICK OP_2 OP_PICK OP_SUB OP_2 OP_ROLL OP_DROP OP_1 OP_ROLL OP_ENDIF OP_3 OP_PICK OP_SIZE OP_NIP OP_2 OP_PICK OP_SIZE OP_NIP OP_3 OP_PICK 20 OP_NUM2BIN OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT 20 OP_2 OP_PICK OP_SUB OP_SPLIT OP_NIP OP_4 OP_3 OP_PICK OP_ADD OP_2 OP_PICK OP_ADD 30 OP_1 OP_PICK OP_CAT OP_2 OP_CAT OP_4 OP_PICK OP_CAT OP_8 OP_PICK OP_CAT OP_2 OP_CAT OP_3 OP_PICK OP_CAT OP_2 OP_PICK OP_CAT OP_7 OP_PICK OP_CAT 0 OP_PICK OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_NOP 0 OP_PICK OP_7 OP_PICK OP_CHECKSIG OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_NOP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_NOP OP_VERIFY OP_5 OP_PICK OP_NOP 0 OP_PICK OP_NOP 0 OP_PICK OP_SIZE OP_NIP OP_1 OP_PICK OP_1 OP_PICK OP_4 OP_SUB OP_SPLIT OP_DROP OP_1 OP_PICK OP_8 OP_SUB OP_SPLIT OP_NIP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_NOP OP_NOP 0 OP_PICK 00 OP_CAT OP_BIN2NUM OP_1 OP_ROLL OP_DROP OP_NOP OP_1 OP_ROLL OP_DROP OP_NOP 0065cd1d OP_LESSTHAN OP_VERIFY OP_5 OP_PICK OP_NOP 0 OP_PICK OP_NOP 0 OP_PICK OP_SIZE OP_NIP OP_1 OP_PICK OP_1 OP_PICK 28 OP_SUB OP_SPLIT OP_DROP OP_1 OP_PICK 2c OP_SUB OP_SPLIT OP_NIP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_NOP OP_NOP 0 OP_PICK 00 OP_CAT OP_BIN2NUM OP_1 OP_ROLL OP_DROP OP_NOP OP_1 OP_ROLL OP_DROP OP_NOP ffffffff00 OP_LESSTHAN OP_VERIFY OP_5 OP_PICK OP_NOP 0 OP_PICK OP_NOP 0 OP_PICK OP_SIZE OP_NIP OP_1 OP_PICK OP_1 OP_PICK OP_4 OP_SUB OP_SPLIT OP_DROP OP_1 OP_PICK OP_8 OP_SUB OP_SPLIT OP_NIP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_NOP OP_NOP 0 OP_PICK 00 OP_CAT OP_BIN2NUM OP_1 OP_ROLL OP_DROP OP_NOP OP_1 OP_ROLL OP_DROP OP_NOP OP_2 OP_PICK OP_GREATERTHANOREQUAL OP_VERIFY OP_6 OP_PICK OP_HASH160 OP_1 OP_PICK OP_EQUAL OP_VERIFY OP_7 OP_PICK OP_7 OP_PICK OP_CHECKSIG OP_NIP OP_NIP OP_NIP OP_NIP OP_NIP OP_NIP OP_NIP OP_NIP`;
const bSocial = new BSocial('lockmarks.com');
const decimalToHex = d => {// helper function to convert integer to hex
    let h = d.toString(16);
    return h.length % 2 ? '0' + h : h;
}
const changeEndianness = string => {// change endianess of hex value before placing into ASM script
    const result = [];
    let len = string.length - 2;
    while (len >= 0) {
      result.push(string.substr(len, 2));
      len -= 2;
    }
    return result.join('');
}
const int2Hex = int => {
    const unreversedHex = decimalToHex(int);
    return changeEndianness(unreversedHex);
}
const hex2Int = hex => {
    const reversedHex = changeEndianness(hex);
    return parseInt(reversedHex, 16);
}
const createLockOutput = (address, blockHeight, satoshis, templateRawTx) => {
    let bsvtx;
    if (templateRawTx) { bsvtx = bsv.Transaction(templateRawTx) } else { bsvtx = bsv.Transaction() }
    const p2pkhOut = new bsv.Transaction.Output({script: bsv.Script(new bsv.Address(address)), satoshis: 1});
    const addressHex = p2pkhOut.script.chunks[2].buf.toString('hex');
    const nLockTimeHexHeight = int2Hex(blockHeight);
    const scriptTemplate = `${LOCKUP_PREFIX} ${addressHex} ${nLockTimeHexHeight} ${LOCKUP_SUFFIX}`;
    const lockingScript = bsv.Script.fromASM(scriptTemplate);
    bsvtx.addOutput(new bsv.Transaction.Output({script: lockingScript, satoshis}));
    return bsvtx.toString();
}
const lockPost = (address, blockHeight, satoshis, signPkWIF, post, replyTxid) => {
    const lockRawTx = createLockOutput(address, blockHeight, satoshis);
    const bPostTx = bPost(lockRawTx, post, replyTxid, signPkWIF);
    return bPostTx;
}
const lockLike = (address, blockHeight, satoshis, signPkWIF, likeTxid, emoji) => {
    const lockRawTx = createLockOutput(address, blockHeight, satoshis);
    const bLikeTx = bLike(lockRawTx, likeTxid, emoji, signPkWIF);
    return bLikeTx;
}
// build the solution to the locking script by constructing the pre image and signature
const unlockLockScript = (txHex, inputIndex, lockTokenScript, satoshis, privkey) => {
    const tx = new bsv.Transaction(txHex);
    const sighashType = bsv.crypto.Signature.SIGHASH_ALL | bsv.crypto.Signature.SIGHASH_FORKID;
    const scriptCode = bsv.Script.fromHex(lockTokenScript);
    const value = new bsv.crypto.BN(satoshis);
    // create preImage of current transaction with valid nLockTime
    const preimg = bsv.Transaction.sighash.sighashPreimage(tx, sighashType, inputIndex, scriptCode, value).toString('hex');
    let s;
    if (privkey) {// sign transaction with private key tied to public key locked in script
        s = bsv.Transaction.sighash.sign(tx, privkey, sighashType, inputIndex, scriptCode, value).toTxFormat();
    }
    return bsv.Script.fromASM(`${s.toString('hex')} ${privkey.toPublicKey().toHex()} ${preimg}`).toHex();
}
const unlockCoins = async(pkWIF, receiveAddress, txid, oIdx = 0) => {
    try {
        const rawtx = await getRawtx(txid);
        const lockedUTXO = getUTXO(rawtx, oIdx);
        if (!lockedUTXO.script.includes(LOCKUP_PREFIX_CHECK)) return
        if (lockedUTXO.satoshis === 1) return   // do not unlock if 1 sat
        const bsvtx = bsv.Transaction();
        const lockedScript = bsv.Script(lockedUTXO.script);
        bsvtx.addInput(new bsv.Transaction.Input({
            prevTxId: txid,
            outputIndex: oIdx,
            script: new bsv.Script()
        }), lockedScript, lockedUTXO.satoshis);
        const lockedBlockHex = lockedScript.chunks[6].buf.toString('hex');
        const lockedBlock = hex2Int(lockedBlockHex);
        const currentHeight = await getBlock();
        if (lockedBlock > currentHeight) {
            addTx({'txid': txid, 'height': lockedBlock, 'satoshis': lockedUTXO.satoshis})
            return
        }
        bsvtx.lockUntilBlockHeight(lockedBlock);
        bsvtx.to(receiveAddress, lockedUTXO.satoshis === 1 ? 1 : lockedUTXO.satoshis - 1); // subtract 1 satoshi to pay the transaction fee
        const solution = unlockLockScript(bsvtx.toString(), oIdx, lockedUTXO.script, lockedUTXO.satoshis, bsv.PrivateKey.fromWIF(pkWIF))
        bsvtx.inputs[0].setScript(solution);
        return bsvtx.toString();
    } catch(e) { console.log(e) }
}
const broadcastUnlockCoins = async (pkWIF, receiveAddress, tx_hash) => {
    let rawtx = await unlockCoins(pkWIF, receiveAddress, tx_hash)   
    if (rawtx !== undefined) {
        const t = await broadcast(rawtx, true, receiveAddress);
        if (t) {
            console.log("unlocked tx: ", t)
            await deleteTx(tx_hash)
        }
    }
    await sleep(2000)
}
const bulkUnlock = async(pkWIF, receiveAddress, identityAddress, fromHeight, toHeight) => {
    const r = await fetch(`https://mornin.run/getLocks`, {
        method: 'post',
        body: JSON.stringify({
            fromHeight,
            toHeight,
            address: identityAddress
        })
    })
    const res = await r.json();
    if (res.length) {
        for (let t of res) {
            const rawtx = await unlockCoins(pkWIF, receiveAddress, t.txid);
            const tx = await broadcast(rawtx);
            console.log(`Unlocked:`, tx);
        }
    }
}
const unlockLocalTxs = async (pkWIF, receiveAddress) => {
    const currentHeight = await getBlock();
    const txs = await getCachedTxs(currentHeight);
    for (let i = 0; i < txs.length; i++) {
        await broadcastUnlockCoins(pkWIF, receiveAddress, txs[i].txid)
    }
}
const unlockAllLockedTxs = async (pkWIF, receiveAddress) => {
    const txs = await getGetConfirmedTxs(receiveAddress)

    for (let i = 0; i < txs.length; i++) {
        const unlockedTxs = listUnlockedTxs();
        if (!unlockedTxs.includes(txs[i].tx_hash)) {
            await broadcastUnlockCoins(pkWIF, receiveAddress, txs[i].tx_hash)   
            addUnlockedTx(txs[i].tx_hash)
        }
    }
}

// SHUAllet.js
const spent = rawtx => {
    const tx = bsv.Transaction(rawtx);
    let utxos = [];
    tx.inputs.forEach(input => {
        let vout = input.outputIndex;
        let txid = input.prevTxId.toString('hex');
        utxos.push({txid, vout, output: `${txid}_${vout}`});
    });
    return utxos;
}
const getGetConfirmedTxs = async(address) => {
    console.log(`Calling WhatsOnChain confirmed history endpoint...`);
    const r = await fetch(`https://api.whatsonchain.com/v1/bsv/main/address/${address}/confirmed/history`);
    const res = await r.json();
    return res.result;
}
const extractUTXOs = (rawtx, addr) => {
    try {
        const tx = new bsv.Transaction(rawtx);
        let utxos = [], vout = 0;
        tx.outputs.forEach(output => {
            let satoshis = output.satoshis;
            let script = new bsv.Script.fromBuffer(output._scriptBuffer);
            if (script.isSafeDataOut()) { vout++; return }
            if (script.isPublicKeyHashOut()) {
                let pkh = bsv.Address.fromPublicKeyHash(script.getPublicKeyHash());
                let address = pkh.toString();
                if (address === addr) {
                    utxos.push({satoshis, txid: tx.hash, vout, script: script.toHex()});
                }
            }
            vout++;
        });
        return utxos;
    }
    catch(error) {
        console.log({error});
        return [];
    }
}
const normalizeUTXOs = utxos => {
    return utxos.map(utxo => {
        return {
            satoshis: utxo?.value || utxo?.satoshis,
            txid: utxo?.txid || utxo.tx_hash,
            vout: utxo.vout === undefined ? utxo.tx_pos : utxo.vout
        }
    })
}
const getUTXOs = async (address, use_woc = 0) => {
    // const utxos = await getCachedUTXOs();
    // if (!utxos.length || use_woc === 1) {
        // console.log(`Calling WhatsOnChain UTXOs endpoint...`);
        // const r1 = await fetch(`https://api.whatsonchain.com/v1/bsv/main/address/${address}/confirmed/unspent`);
        // const res1 = await r1.json();
        // const r2 = await fetch(`https://api.whatsonchain.com/v1/bsv/main/address/${address}/unconfirmed/unspent`);
        // const res2 = await r2.json();
        // return normalizeUTXOs(res1.result.concat(res2.result));

        const r = await fetch(`https://api.bitails.io/address/${address}/unspent`);
        const { unspent } = await r.json();
        return normalizeUTXOs(unspent);
    // } else { return utxos }
}
const btUTXOs = async address => {
    const r = await fetch(`https://api.bitails.io/address/${address}/unspent`);
    const { unspent } = await r.json();
    return normalizeUTXOs(unspent);
}
const between = (x, min, max) => { return x >= min && x <= max }
const getPaymentUTXOs = async(address, amount) => {
    const utxos = await getUTXOs(address, 0);
    const addr = bsv.Address.fromString(address);
    const script = bsv.Script.fromAddress(addr);
    let cache = [], satoshis = 0;
    for (let utxo of utxos) {
        if (utxo.satoshis > 1) {
            const foundUtxo = utxos.find(utxo => utxo.satoshis >= amount + 2);
            if (foundUtxo) {
                return [{ satoshis: foundUtxo.satoshis, vout: foundUtxo.vout, txid: foundUtxo.txid, script: script.toHex() }]
            }
            cache.push(utxo);
            if (amount) {
                satoshis = cache.reduce((a, curr) => { return a + curr.satoshis }, 0);
                if (satoshis >= amount) {
                    return cache.map(utxo => {
                        return { satoshis: utxo.satoshis, vout: utxo.vout, txid: utxo.txid, script: script.toHex() }
                    });
                }
            } else {
                return utxos.map(utxo => {
                    return { satoshis: utxo.satoshis, vout: utxo.vout, txid: utxo.txid, script: script.toHex() }
                });
            }
        }
    }
    return [];
}
const getWalletBalance = async(address = localStorage.walletAddress) => {
    document.getElementsByClassName('create-wallet')[0].style.display = 'none';
    const utxos = await getUTXOs(address, 1);
    utxos.forEach(u => addUTXO(u));
    const balance = utxos.reduce(((t, e) => t + e.satoshis), 0)
    return balance; 
}
const fileUpload = document.getElementById('uploadFile');
if (fileUpload) {
    fileUpload.addEventListener('change', e => {
        const files = e.target.files;
        const file = files[0];
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const json = JSON.parse(e?.target?.result);
                restoreWallet(json.ordPk, json.payPk)
            } catch(e) {
                console.log(e)
                alert(e);
                return;
            }
        }
        reader.readAsText(file);
    })
}
const initWallet = async() => {
    if (localStorage.walletAddress && document.getElementById('walletAddress')) {
        document.getElementById('walletAddress').innerText = localStorage?.walletAddress || '';
        document.getElementsByClassName('backup-wallet')[0].style.display = 'block';
        const balance = await getWalletBalance(localStorage.walletAddress);
        document.getElementById('walletBalance').innerText = `${balance / 100000000} BSV`;
        await unlockLocalTxs(localStorage.walletKey, localStorage.walletAddress)
    }
}
const setupWallet = async() => {
    if (!localStorage.walletKey) {
        const create = confirm(`Do you want to import an existing wallet?`);
        if (!create) {
            const paymentPk = newPK();
            const ownerPK = newPK();
            restoreWallet(ownerPK, paymentPk, true);
            alert(`Wallet created, click OK to download backup json file.`);
            backupWallet();
            location.reload();
        } else { fileUpload.click() }
    } else { alert(`Please backup your wallet before logging out.`) }
}
const backupWallet = () => {
    const a = document.createElement('a');
    const obj = { ordPk: localStorage?.ownerKey, payPk: localStorage.walletKey, identityPk: localStorage.walletKey };
    a.href = URL.createObjectURL( new Blob([JSON.stringify(obj)], { type: 'json' }))
    a.download = 'shuallet.json';
    a.click();
}
const sendBSV = async() => {
    try {
        const amt = prompt(`Enter BSV amount to send:`);
        if (amt === null) return;
        const satoshis = parseInt(parseFloat(amt) * 100000000);
        if (!satoshis) { throw `Invalid amount` }
        const balance = await getWalletBalance();
        if (balance < satoshis) { alert(`Amount entered exceeds balance`); throw `Amount entered exceeds balance`; }
        const sendMax = balance === satoshis;
        const to = prompt(`Enter address to send BSV to:`);
        if (!to) { return }
        const addr = bsv.Address.fromString(to);
        if (addr) {
            const bsvtx = bsv.Transaction();
            if (sendMax) {
                bsvtx.to(addr, satoshis - 1);
            } else {
                bsvtx.to(addr, satoshis);
            }
            const rawtx = await payForRawTx(bsvtx.toString());
            if (rawtx) {
                const c = confirm(`Send ${amt} BSV to ${addr}?`);
                if (c) {
                    const t = await broadcast(rawtx, true, localStorage.walletAddress);
                    alert(t);
                } else { return }
            } 
        }
    } catch(e) {
        console.log(e);
        alert(e);
    }
}
const newPK = () => {
    const pk = new bsv.PrivateKey();
    const pkWIF = pk.toWIF();
    return pkWIF;
}
const restoreWallet = async(oPK, pPk, newWallet) => {
    const pk = bsv.PrivateKey.fromWIF(pPk);
    const pkWif = pk.toString();
    const address = bsv.Address.fromPrivateKey(pk)
    const ownerPk = bsv.PrivateKey.fromWIF(oPK);
    localStorage.ownerKey = ownerPk.toWIF();
    const ownerAddress = bsv.Address.fromPrivateKey(ownerPk);
    localStorage.ownerAddress = ownerAddress.toString();
    localStorage.walletAddress = address.toString();
    localStorage.walletKey = pkWif;
    localStorage.ownerPublicKey = ownerPk.toPublicKey().toHex();
    if (!newWallet) {
        const c = confirm(`Do you want to unlock old coins? It moght take a couple of minutes.`);
        if (c) {
            document.getElementById('walletAddress').innerText = 'Unlocking. It might take a couple of minutes. Please wait...';
            await getWalletBalance(localStorage.walletAddress);
            await unlockAllLockedTxs(localStorage.walletKey, localStorage.walletAddress);
        }
    }
    newWallet ? alert(`Wallet ${address} created!`) : alert(`Wallet ${address} restored!`);
    if (!newWallet) location.reload();
}
const payForRawTx = async rawtx => {
    const bsvtx = bsv.Transaction(rawtx);
    const satoshis = bsvtx.outputs.reduce(((t, e) => t + e._satoshis), 0);
    const txFee = parseInt(((bsvtx._estimateSize() + (P2PKH_INPUT_SIZE * bsvtx.inputs.length)) * FEE_FACTOR)) + 1;
    const utxos = await getPaymentUTXOs(localStorage.walletAddress, satoshis + txFee);
    if (!utxos.length) { throw `Insufficient funds` }
    bsvtx.from(utxos);
    const inputSatoshis = utxos.reduce(((t, e) => t + e.satoshis), 0);
    bsvtx.to(localStorage.walletAddress, inputSatoshis - satoshis - txFee);
    bsvtx.sign(bsv.PrivateKey.fromWIF(localStorage.walletKey));
    return bsvtx.toString();
}
const logout = () => {
    if (localStorage.walletKey) {
        const conf = confirm(`Are you sure you want to logout?

If so, please ensure your wallet is backed up first!`);
        if (!conf) return;
        localStorage.clear();
        clearUTXOs();
        clearTxs();
        deleteDB();
        location.reload();
    }
}
initWallet();
