import React, { useState } from 'react';
import { createElection } from '../utils/blockchain';
import styles from './CreateElection.module.css';

export default function CreateElection({ onCreated, onCancel }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!title.trim()) { setError('Election title is required.'); return; }
    setLoading(true); setError('');
    try {
      const id = await createElection(title.trim(), description.trim());
      onCreated(id);
    } catch (e) {
      setError(e.reason || e.message || 'Transaction failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <button className={styles.back} onClick={onCancel}>← Back to Dashboard</button>
      <div className={styles.card + ' animate-fadeUp'}>
        <div className={styles.cardHeader}>
          <h2 className={styles.title}>Create New Election</h2>
          <p className={styles.subtitle}>Deploy a new election contract on the Ethereum blockchain. You'll become the admin and can add candidates before starting the election.</p>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Election Title <span className={styles.required}>*</span></label>
            <input
              className={styles.input}
              placeholder="e.g. Student Council Election 2025"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={100}
              disabled={loading}
            />
            <span className={styles.charCount}>{title.length}/100</span>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Description</label>
            <textarea
              className={styles.textarea}
              placeholder="Brief description of the election purpose and rules…"
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={500}
              rows={4}
              disabled={loading}
            />
            <span className={styles.charCount}>{description.length}/500</span>
          </div>

          <div className={styles.infoBox}>
            <div className={styles.infoIcon}>ℹ</div>
            <div>
              <strong>What happens next:</strong>
              <ul className={styles.infoList}>
                <li>A transaction is submitted to create the election on-chain</li>
                <li>You'll be taken to the election admin panel</li>
                <li>Add at least 2 candidates before starting</li>
                <li>Advance phases: Created → Commit → Reveal → Ended</li>
              </ul>
            </div>
          </div>

          <div className={styles.btnRow}>
            <button className={styles.cancelBtn} onClick={onCancel} disabled={loading}>Cancel</button>
            <button className={styles.submitBtn} onClick={handleSubmit} disabled={loading || !title.trim()}>
              {loading ? (
                <><Spinner /> Creating on Blockchain…</>
              ) : (
                'Create Election'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return <span style={{ display:'inline-block', width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTop:'2px solid white', borderRadius:'50%', animation:'spin 0.8s linear infinite', marginRight:8 }} />;
}
