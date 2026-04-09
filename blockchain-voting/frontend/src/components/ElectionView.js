import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchElection, fetchAllCandidates, fetchVoterStatus, fetchWinner,
  advancePhase, addCandidate, commitVote, revealVote,
  PHASES, PHASE_COLORS, PHASE_DESC, shortenAddress
} from '../utils/blockchain';
import styles from './ElectionView.module.css';

export default function ElectionView({ electionId, account, onBack }) {
  const [election, setElection] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [voterStatus, setVoterStatus] = useState({ hasCommitted: false, hasRevealed: false });
  const [winner, setWinner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isAdmin = election?.admin?.toLowerCase() === account?.toLowerCase();

  const refresh = useCallback(async () => {
    try {
      const e = await fetchElection(electionId);
      const c = await fetchAllCandidates(electionId);
      const vs = await fetchVoterStatus(electionId, account);
      setElection(e);
      setCandidates(c);
      setVoterStatus(vs);
      if (e.phase === 3) {
        try { const w = await fetchWinner(electionId); setWinner(w); } catch {}
      }
    } catch (err) {
      setError('Failed to load election: ' + (err.reason || err.message));
    } finally {
      setLoading(false);
    }
  }, [electionId, account]);

  useEffect(() => { refresh(); }, [refresh]);

  const withTx = async (fn, successMsg) => {
    setTxLoading(true); setError(''); setSuccess('');
    try {
      await fn();
      setSuccess(successMsg);
      await refresh();
    } catch (e) {
      setError(e.reason || e.message || 'Transaction failed.');
    } finally {
      setTxLoading(false);
    }
  };

  if (loading) return (
    <div className={styles.centered}>
      <div className={styles.spinner} />
      <span>Loading election from blockchain…</span>
    </div>
  );

  if (!election) return (
    <div className={styles.centered}>
      <span style={{ color: 'var(--red)' }}>Election not found.</span>
      <button className={styles.backBtn} onClick={onBack}>← Back</button>
    </div>
  );

  const phase = election.phase;
  const phaseColor = PHASE_COLORS[phase];

  return (
    <div className={styles.page}>
      {/* Back */}
      <button className={styles.backBtn} onClick={onBack}>← Back to Dashboard</button>

      {/* Election Header */}
      <div className={styles.electionHeader + ' animate-fadeUp'}>
        <div className={styles.electionMeta}>
          <div className={styles.electionIdBadge}>Election #{election.id}</div>
          {isAdmin && <div className={styles.adminBadge}>You are Admin</div>}
        </div>
        <h1 className={styles.electionTitle}>{election.title}</h1>
        {election.description && <p className={styles.electionDesc}>{election.description}</p>}

        {/* Phase stepper */}
        <div className={styles.stepper}>
          {PHASES.map((p, i) => (
            <React.Fragment key={i}>
              <div className={styles.step + (i === phase ? ' ' + styles.stepActive : '') + (i < phase ? ' ' + styles.stepDone : '')}>
                <div className={styles.stepCircle} style={i === phase ? { borderColor: phaseColor, color: phaseColor, background: phaseColor + '18' } : {}}>
                  {i < phase ? '✓' : i + 1}
                </div>
                <div className={styles.stepLabel}>{p}</div>
              </div>
              {i < 3 && <div className={styles.stepLine + (i < phase ? ' ' + styles.stepLineDone : '')} />}
            </React.Fragment>
          ))}
        </div>

        <div className={styles.phaseInfo} style={{ borderColor: phaseColor + '40', background: phaseColor + '0d' }}>
          <span style={{ color: phaseColor }}>●</span>
          <span style={{ color: 'var(--text2)', fontSize: 13 }}>{PHASE_DESC[phase]}</span>
        </div>

        {/* Stats row */}
        <div className={styles.statsRow}>
          {[
            { label: 'Candidates', value: election.candidateCount },
            { label: 'Commits', value: election.totalCommits },
            { label: 'Reveals', value: election.totalReveals },
            { label: 'Admin', value: shortenAddress(election.admin) },
          ].map((s, i) => (
            <div key={i} className={styles.stat}>
              <div className={styles.statVal}>{s.value}</div>
              <div className={styles.statLbl}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className={styles.alertError + ' animate-fadeUp'}>
          <span>⚠ {error}</span>
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}
      {success && (
        <div className={styles.alertSuccess + ' animate-fadeUp'}>
          <span>✓ {success}</span>
          <button onClick={() => setSuccess('')}>✕</button>
        </div>
      )}

      {/* Winner Banner */}
      {phase === 3 && winner && (
        <WinnerBanner winner={winner} candidates={candidates} />
      )}

      {/* Two-column layout */}
      <div className={styles.columns}>
        {/* Left: Candidates */}
        <div className={styles.col}>
          <CandidatesPanel
            candidates={candidates}
            phase={phase}
            isAdmin={isAdmin}
            txLoading={txLoading}
            electionId={electionId}
            winner={winner}
            withTx={withTx}
          />
        </div>

        {/* Right: Admin or Voter panel */}
        <div className={styles.col}>
          {isAdmin ? (
            <AdminPanel
              election={election}
              phase={phase}
              txLoading={txLoading}
              withTx={withTx}
              electionId={electionId}
            />
          ) : (
            <VoterPanel
              election={election}
              candidates={candidates}
              voterStatus={voterStatus}
              phase={phase}
              txLoading={txLoading}
              withTx={withTx}
              electionId={electionId}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  Winner Banner
// ─────────────────────────────────────────────────────────
function WinnerBanner({ winner, candidates }) {
  const total = candidates.reduce((sum, c) => sum + c.voteCount, 0);
  const pct = total > 0 ? Math.round((winner.votes / total) * 100) : 0;
  return (
    <div className={styles.winnerBanner + ' animate-fadeUp'}>
      <div className={styles.winnerGlow} />
      <div className={styles.winnerIcon}>🏆</div>
      <div className={styles.winnerContent}>
        <div className={styles.winnerLabel}>Election Winner</div>
        <div className={styles.winnerName}>{winner.name}</div>
        <div className={styles.winnerParty}>{winner.party}</div>
      </div>
      <div className={styles.winnerStats}>
        <div className={styles.winnerVotes}>{winner.votes} <span>votes</span></div>
        <div className={styles.winnerPct}>{pct}% of revealed</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  Candidates Panel
// ─────────────────────────────────────────────────────────
function CandidatesPanel({ candidates, phase, isAdmin, txLoading, electionId, winner, withTx }) {
  const [addName, setAddName] = useState('');
  const [addParty, setAddParty] = useState('');
  const [showForm, setShowForm] = useState(false);

  const total = candidates.reduce((sum, c) => sum + c.voteCount, 0);

  const handleAdd = () => {
    if (!addName.trim()) return;
    withTx(
      () => addCandidate(electionId, addName.trim(), addParty.trim()),
      `Candidate "${addName}" added successfully.`
    ).then(() => { setAddName(''); setAddParty(''); setShowForm(false); });
  };

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>Candidates</h3>
        <span className={styles.panelCount}>{candidates.length}</span>
        {isAdmin && phase === 0 && (
          <button className={styles.addBtn} onClick={() => setShowForm(v => !v)}>
            {showForm ? '✕ Cancel' : '+ Add'}
          </button>
        )}
      </div>

      {/* Add candidate form */}
      {showForm && isAdmin && phase === 0 && (
        <div className={styles.addForm}>
          <input className={styles.input} placeholder="Candidate name *" value={addName} onChange={e => setAddName(e.target.value)} />
          <input className={styles.input} placeholder="Party / affiliation" value={addParty} onChange={e => setAddParty(e.target.value)} />
          <button className={styles.submitBtn} onClick={handleAdd} disabled={txLoading || !addName.trim()}>
            {txLoading ? 'Adding…' : 'Add Candidate'}
          </button>
        </div>
      )}

      {candidates.length === 0 ? (
        <div className={styles.emptyPanel}>
          <span>No candidates added yet.</span>
          {isAdmin && phase === 0 && <span style={{ color: 'var(--accent2)', fontSize: 12 }}>Add at least 2 to start the election.</span>}
        </div>
      ) : (
        <div className={styles.candidateList}>
          {candidates.map((c, i) => {
            const pct = total > 0 ? (c.voteCount / total) * 100 : 0;
            const isWinner = winner?.id === c.id;
            return (
              <div key={c.id} className={styles.candidateCard + (isWinner ? ' ' + styles.candidateWinner : '')}>
                <div className={styles.candidateTop}>
                  <div className={styles.candidateNum}>{i + 1}</div>
                  <div className={styles.candidateInfo}>
                    <div className={styles.candidateName}>{c.name} {isWinner && '🏆'}</div>
                    {c.party && <div className={styles.candidateParty}>{c.party}</div>}
                  </div>
                  {phase >= 3 && (
                    <div className={styles.candidateVotes}>{c.voteCount} <span>votes</span></div>
                  )}
                </div>
                {phase >= 3 && total > 0 && (
                  <div className={styles.voteBar}>
                    <div
                      className={styles.voteBarFill + (isWinner ? ' ' + styles.voteBarWinner : '')}
                      style={{ width: pct + '%' }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  Admin Panel
// ─────────────────────────────────────────────────────────
function AdminPanel({ election, phase, txLoading, withTx, electionId }) {
  const nextPhaseLabel = ['Start Commit Phase', 'Start Reveal Phase', 'End Election', null][phase];
  const canAdvance = !(phase === 0 && election.candidateCount < 2) && phase < 3;
  const advanceWarning = phase === 0 && election.candidateCount < 2
    ? 'Need at least 2 candidates to start.'
    : phase === 1 && election.totalCommits === 0
    ? 'No votes committed yet — voters cannot reveal.'
    : null;

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>Admin Controls</h3>
        <span className={styles.adminTag}>Admin</span>
      </div>

      <div className={styles.adminContent}>
        {/* Current phase */}
        <div className={styles.adminPhase}>
          <div className={styles.adminPhaseLabel}>Current Phase</div>
          <div className={styles.adminPhaseName} style={{ color: PHASE_COLORS[phase] }}>
            {PHASES[phase]}
          </div>
          <div className={styles.adminPhaseDesc}>{PHASE_DESC[phase]}</div>
        </div>

        {/* Phase checklist */}
        <div className={styles.checklist}>
          {phase === 0 && [
            { done: election.candidateCount >= 2, label: `At least 2 candidates (${election.candidateCount} added)` },
          ].map((item, i) => (
            <div key={i} className={styles.checkItem}>
              <span className={item.done ? styles.checkDone : styles.checkPending}>{item.done ? '✓' : '○'}</span>
              <span style={{ color: item.done ? 'var(--green2)' : 'var(--text2)' }}>{item.label}</span>
            </div>
          ))}
          {phase === 1 && [
            { done: election.totalCommits > 0, label: `Votes committed (${election.totalCommits})` },
          ].map((item, i) => (
            <div key={i} className={styles.checkItem}>
              <span className={item.done ? styles.checkDone : styles.checkPending}>{item.done ? '✓' : '○'}</span>
              <span style={{ color: item.done ? 'var(--green2)' : 'var(--text2)' }}>{item.label}</span>
            </div>
          ))}
          {phase === 2 && [
            { done: true, label: `Reveals so far: ${election.totalReveals} / ${election.totalCommits}` },
          ].map((item, i) => (
            <div key={i} className={styles.checkItem}>
              <span className={styles.checkDone}>ℹ</span>
              <span style={{ color: 'var(--text2)' }}>{item.label}</span>
            </div>
          ))}
        </div>

        {advanceWarning && (
          <div className={styles.warning}>{advanceWarning}</div>
        )}

        {phase < 3 ? (
          <button
            className={styles.advanceBtn}
            onClick={() => withTx(() => advancePhase(electionId), `Phase advanced to: ${PHASES[Math.min(phase + 1, 3)]}`)}
            disabled={txLoading || !canAdvance}
          >
            {txLoading ? <><Spinner /> Processing…</> : nextPhaseLabel}
          </button>
        ) : (
          <div className={styles.endedNote}>
            <span>🔒</span> Election has ended. Results are final and permanently stored on-chain.
          </div>
        )}

        {/* On-chain info */}
        <div className={styles.onChainInfo}>
          <div className={styles.onChainRow}>
            <span>Contract</span>
            <span className={styles.mono}>chain #{electionId}</span>
          </div>
          <div className={styles.onChainRow}>
            <span>Admin</span>
            <span className={styles.mono}>{shortenAddress(election.admin)}</span>
          </div>
          <div className={styles.onChainRow}>
            <span>Commits</span>
            <span className={styles.mono}>{election.totalCommits}</span>
          </div>
          <div className={styles.onChainRow}>
            <span>Reveals</span>
            <span className={styles.mono}>{election.totalReveals}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  Voter Panel
// ─────────────────────────────────────────────────────────
function VoterPanel({ election, candidates, voterStatus, phase, txLoading, withTx, electionId }) {
  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [secret, setSecret] = useState('');
  const [revealCandidate, setRevealCandidate] = useState('');
  const [revealSecret, setRevealSecret] = useState('');
  const [secretSaved, setSecretSaved] = useState(false);

  const handleCommit = () => {
    if (!selectedCandidate || !secret.trim()) return;
    if (secret.length < 4) { return; }
    withTx(
      () => commitVote(electionId, Number(selectedCandidate), secret),
      'Vote committed successfully! Save your secret — you will need it to reveal.'
    );
  };

  const handleReveal = () => {
    if (!revealCandidate || !revealSecret.trim()) return;
    withTx(
      () => revealVote(electionId, Number(revealCandidate), revealSecret),
      'Vote revealed and counted successfully!'
    );
  };

  // Phase 0: not started
  if (phase === 0) return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}><h3 className={styles.panelTitle}>Your Vote</h3></div>
      <div className={styles.voterWaiting}>
        <div className={styles.waitIcon}>⏳</div>
        <p>The election hasn't started yet.</p>
        <p className={styles.waitSub}>Wait for the admin to start the Commit Phase.</p>
      </div>
    </div>
  );

  // Phase 1: Commit
  if (phase === 1) return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>Cast Your Vote</h3>
        <span className={styles.phaseTag} style={{ background: PHASE_COLORS[1] + '20', color: PHASE_COLORS[1], borderColor: PHASE_COLORS[1] + '40' }}>Commit Phase</span>
      </div>

      {voterStatus.hasCommitted ? (
        <div className={styles.alreadyDone}>
          <div className={styles.doneIcon}>🔒</div>
          <h4>Vote Committed</h4>
          <p>Your encrypted vote is recorded on the blockchain. Keep your <strong>secret</strong> safe — you'll need it during the Reveal Phase.</p>
          <div className={styles.secretReminder}>
            <span className={styles.secretReminderIcon}>⚠</span>
            If you lose your secret, you won't be able to reveal your vote.
          </div>
        </div>
      ) : (
        <div className={styles.voteForm}>
          <div className={styles.howItWorks}>
            <strong>How Commit–Reveal works:</strong>
            <ol className={styles.howList}>
              <li>Select your candidate and enter a secret phrase</li>
              <li>A cryptographic hash is submitted — your vote stays hidden</li>
              <li>In Reveal Phase, use same candidate + secret to reveal</li>
            </ol>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Select Candidate</label>
            <div className={styles.candidateOptions}>
              {candidates.map(c => (
                <button
                  key={c.id}
                  className={styles.candidateOption + (selectedCandidate == c.id ? ' ' + styles.candidateOptionSelected : '')}
                  onClick={() => setSelectedCandidate(c.id.toString())}
                >
                  <span className={styles.optionDot} />
                  <div>
                    <div className={styles.optionName}>{c.name}</div>
                    {c.party && <div className={styles.optionParty}>{c.party}</div>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Secret Phrase <span className={styles.required}>*</span></label>
            <input
              className={styles.input}
              placeholder="Enter a memorable secret (min 4 chars)"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              maxLength={31}
            />
            <span className={styles.fieldHint}>⚠ Remember this! You need it to reveal your vote.</span>
          </div>

          <label className={styles.checkboxRow}>
            <input type="checkbox" checked={secretSaved} onChange={e => setSecretSaved(e.target.checked)} />
            <span>I have saved my secret phrase and candidate choice</span>
          </label>

          <button
            className={styles.voteBtn}
            onClick={handleCommit}
            disabled={txLoading || !selectedCandidate || secret.length < 4 || !secretSaved}
          >
            {txLoading ? <><Spinner /> Submitting…</> : '🔒 Commit Vote'}
          </button>
        </div>
      )}
    </div>
  );

  // Phase 2: Reveal
  if (phase === 2) return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>Reveal Your Vote</h3>
        <span className={styles.phaseTag} style={{ background: PHASE_COLORS[2] + '20', color: PHASE_COLORS[2], borderColor: PHASE_COLORS[2] + '40' }}>Reveal Phase</span>
      </div>

      {!voterStatus.hasCommitted ? (
        <div className={styles.alreadyDone}>
          <div className={styles.doneIcon}>ℹ️</div>
          <h4>No Committed Vote</h4>
          <p>You did not commit a vote during the Commit Phase. Only voters who committed can reveal.</p>
        </div>
      ) : voterStatus.hasRevealed ? (
        <div className={styles.alreadyDone}>
          <div className={styles.doneIcon}>✅</div>
          <h4>Vote Revealed</h4>
          <p>Your vote has been counted. Results will be available when the admin ends the election.</p>
        </div>
      ) : (
        <div className={styles.voteForm}>
          <div className={styles.revealInfo}>
            Enter the same <strong>candidate</strong> and <strong>secret</strong> you used when committing.
            The contract will verify the hash before counting your vote.
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Your Candidate</label>
            <div className={styles.candidateOptions}>
              {candidates.map(c => (
                <button
                  key={c.id}
                  className={styles.candidateOption + (revealCandidate == c.id ? ' ' + styles.candidateOptionSelected : '')}
                  onClick={() => setRevealCandidate(c.id.toString())}
                >
                  <span className={styles.optionDot} />
                  <div>
                    <div className={styles.optionName}>{c.name}</div>
                    {c.party && <div className={styles.optionParty}>{c.party}</div>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Your Secret Phrase</label>
            <input
              className={styles.input}
              placeholder="Enter the same secret from commit phase"
              value={revealSecret}
              onChange={e => setRevealSecret(e.target.value)}
              maxLength={31}
            />
          </div>

          <button
            className={styles.voteBtn}
            onClick={handleReveal}
            disabled={txLoading || !revealCandidate || !revealSecret.trim()}
            style={{ background: 'var(--green)', boxShadow: txLoading ? 'none' : '0 0 16px rgba(16,185,129,0.3)' }}
          >
            {txLoading ? <><Spinner /> Revealing…</> : '✓ Reveal Vote'}
          </button>
        </div>
      )}
    </div>
  );

  // Phase 3: Ended
  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}><h3 className={styles.panelTitle}>Your Vote Status</h3></div>
      <div className={styles.alreadyDone}>
        <div className={styles.doneIcon}>🔒</div>
        <h4>Election Ended</h4>
        <div className={styles.voteStatusGrid}>
          <div className={styles.voteStatusItem}>
            <span className={voterStatus.hasCommitted ? styles.checkDone : styles.checkPending}>
              {voterStatus.hasCommitted ? '✓' : '✕'}
            </span>
            Committed
          </div>
          <div className={styles.voteStatusItem}>
            <span className={voterStatus.hasRevealed ? styles.checkDone : styles.checkPending}>
              {voterStatus.hasRevealed ? '✓' : '✕'}
            </span>
            Revealed
          </div>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 8 }}>
          Results are permanently recorded on the blockchain.
        </p>
      </div>
    </div>
  );
}

function Spinner() {
  return <span style={{ display:'inline-block', width:13, height:13, border:'2px solid rgba(255,255,255,0.3)', borderTop:'2px solid white', borderRadius:'50%', animation:'spin 0.8s linear infinite', marginRight:6 }} />;
}
