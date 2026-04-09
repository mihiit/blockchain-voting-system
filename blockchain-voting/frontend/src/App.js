import React, { useState, useEffect, useCallback } from 'react';
import { connectWallet, getCurrentAccount, fetchElectionCount } from './utils/blockchain';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import ElectionView from './components/ElectionView';
import CreateElection from './components/CreateElection';
import styles from './App.module.css';


export default function App() {
  const [account, setAccount] = useState(null);
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'create' | 'election'
  const [selectedElectionId, setSelectedElectionId] = useState(null);
  const [electionCount, setElectionCount] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  // ─── Wallet ───────────────────────────────────────────────
  const handleConnect = async () => {
    setConnecting(true);
    setError('');
    try {
      const acc = await connectWallet();
      setAccount(acc);
    } catch (e) {
      setError(e.message);
    } finally {
      setConnecting(false);
    }
  };

  useEffect(() => {
    getCurrentAccount().then(acc => { if (acc) setAccount(acc); });
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', accs => setAccount(accs[0] || null));
      window.ethereum.on('chainChanged', () => window.location.reload());
    }
  }, []);

  // ─── Election count ────────────────────────────────────────
  const refreshCount = useCallback(async () => {
    if (!account) return;
    try {
      const c = await fetchElectionCount();
      setElectionCount(c);
    } catch {}
  }, [account]);

  useEffect(() => { refreshCount(); }, [refreshCount]);

  // ─── Navigation ────────────────────────────────────────────
  const goToDashboard = () => { setView('dashboard'); setSelectedElectionId(null); };
  const goToElection = (id) => { setSelectedElectionId(id); setView('election'); };
  const goToCreate = () => setView('create');

  const onElectionCreated = async (id) => {
    await refreshCount();
    goToElection(id);
  };

  return (
    <div className={styles.app}>
      <Header
        account={account}
        onConnect={handleConnect}
        connecting={connecting}
        onHome={goToDashboard}
        currentView={view}
      />

      {error && (
        <div className={styles.globalError}>
          <span>⚠ {error}</span>
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}

      {!account ? (
        <WalletGate onConnect={handleConnect} connecting={connecting} />
      ) : (
        <main className={styles.main}>
          {view === 'dashboard' && (
            <Dashboard
              account={account}
              electionCount={electionCount}
              onOpenElection={goToElection}
              onCreateElection={goToCreate}
              onRefresh={refreshCount}
            />
          )}
          {view === 'create' && (
            <CreateElection
              account={account}
              onCreated={onElectionCreated}
              onCancel={goToDashboard}
            />
          )}
          {view === 'election' && selectedElectionId && (
            <ElectionView
              electionId={selectedElectionId}
              account={account}
              onBack={goToDashboard}
            />
          )}
        </main>
      )}
    </div>
  );
}

function WalletGate({ onConnect, connecting }) {
  return (
    <div className={styles.walletGate}>
      <div className={styles.walletCard}>
        <div className={styles.walletIcon}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect x="4" y="12" width="40" height="28" rx="4" stroke="#3b82f6" strokeWidth="2"/>
            <path d="M4 20h40" stroke="#3b82f6" strokeWidth="2"/>
            <circle cx="34" cy="30" r="3" fill="#3b82f6"/>
            <path d="M8 8l6-4h20l6 4" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <h2 className={styles.walletTitle}>Connect Your Wallet</h2>
        <p className={styles.walletDesc}>
          Connect MetaMask to access the decentralized voting system.
          Make sure you're connected to the local Hardhat network.
        </p>
        <div className={styles.walletSteps}>
          {['Install MetaMask browser extension', 'Add Hardhat network (localhost:8545, Chain ID: 31337)', 'Import a Hardhat test account using its private key', 'Click Connect below'].map((s, i) => (
            <div key={i} className={styles.walletStep}>
              <span className={styles.stepNum}>{i + 1}</span>
              <span>{s}</span>
            </div>
          ))}
        </div>
        <button className={styles.connectBtn} onClick={onConnect} disabled={connecting}>
          {connecting ? <><Spinner /> Connecting...</> : 'Connect MetaMask'}
        </button>
      </div>
    </div>
  );
}

function Spinner() {
  return <span style={{ display:'inline-block', width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTop:'2px solid white', borderRadius:'50%', animation:'spin 0.8s linear infinite', marginRight:8, verticalAlign:'middle' }} />;
}
