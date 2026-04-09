import React from 'react';
import { shortenAddress } from '../utils/blockchain';
import styles from './Header.module.css';

export default function Header({ account, onConnect, connecting, onHome }) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <button className={styles.brand} onClick={onHome}>
          <div className={styles.logo}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M11 2L3 6.5V15.5L11 20L19 15.5V6.5L11 2Z" stroke="#3b82f6" strokeWidth="1.5" fill="rgba(59,130,246,0.1)"/>
              <path d="M11 2v18M3 6.5l8 5 8-5" stroke="#3b82f6" strokeWidth="1.5"/>
            </svg>
          </div>
          <div>
            <div className={styles.brandName}>VoteChain</div>
            <div className={styles.brandSub}>Decentralized Voting</div>
          </div>
        </button>

        <div className={styles.right}>
          <div className={styles.networkBadge}>
            <span className={styles.networkDot} />
            Hardhat Local
          </div>
          {account ? (
            <div className={styles.walletInfo}>
              <div className={styles.walletDot} />
              <span className={styles.walletAddr}>{shortenAddress(account)}</span>
            </div>
          ) : (
            <button className={styles.connectBtn} onClick={onConnect} disabled={connecting}>
              {connecting ? 'Connecting…' : 'Connect Wallet'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
