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
const initWallet = async(loadQR = 0) => {
    if (localStorage.walletAddress && document.getElementById('walletAddress')) {
        document.getElementById('walletAddress').innerText = localStorage?.walletAddress || '';
        if (loadQR === 1) {
            var qrcode = new QRCode("qrcode", localStorage.walletAddress);
        }
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
initWallet(1);