import React, { useState, useEffect } from 'react';
import { fetchElection, fetchAllCandidates, PHASES, PHASE_COLORS } from '../utils/blockchain';
import styles from './Dashboard.module.css';

export default function Dashboard({ account, electionCount, onOpenElection, onCreateElection, onRefresh }) {
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (electionCount === 0) { setElections([]); return; }
    setLoading(true);
    const load = async () => {
      try {
        const results = await Promise.all(
          Array.from({ length: electionCount }, (_, i) =>
            fetchElection(i + 1).then(async e => {
              const candidates = await fetchAllCandidates(e.id);
              return { ...e, candidates };
            })
          )
        );
        setElections(results.reverse());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [electionCount]);

  return (
    <div className={styles.dashboard}>
      {/* Hero */}
      <div className={styles.hero + ' animate-fadeUp'}>
        <div className={styles.heroText}>
          <div className={styles.heroLabel}>
            <span className={styles.heroDot} />
            Blockchain Voting System
          </div>
          <h1 className={styles.heroTitle}>Secure.<br />Transparent.<br />Immutable.</h1>
          <p className={styles.heroDesc}>
            Every vote is cryptographically sealed and stored permanently on the Ethereum blockchain.
            No single point of trust. No manipulation possible.
          </p>
        </div>
        <div className={styles.heroStats}>
          {[
            { label: 'Elections', value: electionCount },
            { label: 'Network', value: 'Hardhat' },
            { label: 'Protocol', value: 'Commit–Reveal' },
          ].map((s, i) => (
            <div key={i} className={styles.statCard}>
              <div className={styles.statValue}>{s.value}</div>
              <div className={styles.statLabel}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Action bar */}
      <div className={styles.actionBar + ' animate-fadeUp-d1'}>
        <h2 className={styles.sectionTitle}>
          {electionCount === 0 ? 'No elections yet' : `${electionCount} Election${electionCount !== 1 ? 's' : ''}`}
        </h2>
        <div className={styles.actions}>
          <button className={styles.refreshBtn} onClick={onRefresh} title="Refresh">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            Refresh
          </button>
          <button className={styles.createBtn} onClick={onCreateElection}>
            + Create Election
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span>Loading elections from blockchain…</span>
        </div>
      ) : elections.length === 0 ? (
        <div className={styles.empty + ' animate-fadeUp-d2'}>
          <div className={styles.emptyIcon}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect x="4" y="8" width="32" height="24" rx="4" stroke="#3b82f6" strokeWidth="1.5"/>
              <path d="M12 16h16M12 22h10" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <h3>No elections found</h3>
          <p>Create the first election on this blockchain network.</p>
          <button className={styles.createBtn} onClick={onCreateElection}>
            + Create First Election
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {elections.map((e, i) => (
            <ElectionCard key={e.id} election={e} account={account} onClick={() => onOpenElection(e.id)} delay={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function ElectionCard({ election, account, onClick, delay }) {
  const phase = election.phase;
  const isAdmin = election.admin?.toLowerCase() === account?.toLowerCase();
  const color = PHASE_COLORS[phase];

  return (
    <div
      className={styles.card}
      style={{ animationDelay: `${delay * 0.05}s` }}
      onClick={onClick}
    >
      <div className={styles.cardTop}>
        <span className={styles.electionId}>#{election.id}</span>
        {isAdmin && <span className={styles.adminBadge}>Admin</span>}
      </div>
      <h3 className={styles.cardTitle}>{election.title}</h3>
      {election.description && (
        <p className={styles.cardDesc}>{election.description.slice(0, 80)}{election.description.length > 80 ? '…' : ''}</p>
      )}
      <div className={styles.cardStats}>
        <span>{election.candidates.length} candidate{election.candidates.length !== 1 ? 's' : ''}</span>
        <span>{election.totalCommits} commits</span>
        <span>{election.totalReveals} reveals</span>
      </div>
      <div className={styles.cardFooter}>
        <div className={styles.phaseBadge} style={{ color, borderColor: color + '40', background: color + '12' }}>
          <span className={styles.phaseDot} style={{ background: color }} />
          {PHASES[phase]}
        </div>
        <span className={styles.viewLink}>View →</span>
      </div>
    </div>
  );
}
