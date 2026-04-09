import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from './contract';

// ─── Provider / Signer ────────────────────────────────────────────
export async function getProvider() {
  if (!window.ethereum) throw new Error('MetaMask not found. Please install MetaMask.');
  return new ethers.BrowserProvider(window.ethereum);
}

export async function getSigner() {
  const provider = await getProvider();
  return provider.getSigner();
}

export async function getContract(signerOrProvider) {
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signerOrProvider);
}

// ─── Wallet ───────────────────────────────────────────────────────
const HARDHAT_CHAIN_ID = '0x7a69'; // 31337 in hex

export async function ensureCorrectNetwork() {
  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  if (chainId === HARDHAT_CHAIN_ID) return; // already on correct network

  try {
    // Try switching to it first (works if user added it before)
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: HARDHAT_CHAIN_ID }],
    });
  } catch (switchError) {
    // Error 4902 = chain not added yet — add it automatically
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: HARDHAT_CHAIN_ID,
          chainName: 'Hardhat Local',
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: ['http://127.0.0.1:8545'],
        }],
      });
    } else {
      throw new Error('Please switch MetaMask to Hardhat Local (Chain ID: 31337)');
    }
  }
}

export async function connectWallet() {
  if (!window.ethereum) throw new Error('MetaMask not installed');
  await ensureCorrectNetwork();
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  return accounts[0];
}

export async function getCurrentAccount() {
  if (!window.ethereum) return null;
  const accounts = await window.ethereum.request({ method: 'eth_accounts' });
  return accounts[0] || null;
}

// ─── Hash helpers ─────────────────────────────────────────────────
/**
 * Generate commit hash matching Solidity: keccak256(abi.encodePacked(candidateId, secret))
 */
export function generateCommitHash(candidateId, secret) {
  const secretBytes = ethers.encodeBytes32String(secret.padEnd(0).substring(0, 31));
  return ethers.solidityPackedKeccak256(
    ['uint256', 'bytes32'],
    [BigInt(candidateId), secretBytes]
  );
}

export function encodeSecret(secret) {
  return ethers.encodeBytes32String(secret.substring(0, 31));
}

// ─── Phase labels ─────────────────────────────────────────────────
export const PHASES = ['Created', 'Commit Phase', 'Reveal Phase', 'Ended'];
export const PHASE_COLORS = ['#64748b', '#f59e0b', '#3b82f6', '#10b981'];
export const PHASE_DESC = [
  'Add candidates before starting the election.',
  'Voters submit their encrypted vote commitment.',
  'Voters reveal their vote to be counted.',
  'Election complete. Results are final.',
];

// ─── Contract calls ───────────────────────────────────────────────
export async function createElection(title, description) {
  const signer = await getSigner();
  const contract = await getContract(signer);
  const tx = await contract.createElection(title, description);
  const receipt = await tx.wait();
  // Parse ElectionCreated event
  const event = receipt.logs
    .map(log => { try { return contract.interface.parseLog(log); } catch { return null; } })
    .find(e => e && e.name === 'ElectionCreated');
  return event ? Number(event.args.electionId) : null;
}

export async function addCandidate(electionId, name, party) {
  const signer = await getSigner();
  const contract = await getContract(signer);
  const tx = await contract.addCandidate(electionId, name, party);
  return tx.wait();
}

export async function advancePhase(electionId) {
  const signer = await getSigner();
  const contract = await getContract(signer);
  const tx = await contract.advancePhase(electionId);
  return tx.wait();
}

export async function commitVote(electionId, candidateId, secret) {
  const signer = await getSigner();
  const contract = await getContract(signer);
  const hash = generateCommitHash(candidateId, secret);
  const tx = await contract.commitVote(electionId, hash);
  return tx.wait();
}

export async function revealVote(electionId, candidateId, secret) {
  const signer = await getSigner();
  const contract = await getContract(signer);
  const secretBytes = encodeSecret(secret);
  const tx = await contract.revealVote(electionId, BigInt(candidateId), secretBytes);
  return tx.wait();
}

export async function fetchElection(electionId) {
  const provider = await getProvider();
  const contract = await getContract(provider);
  const e = await contract.getElection(electionId);
  return {
    id: Number(e.id),
    title: e.title,
    description: e.description,
    admin: e.admin,
    phase: Number(e.phase),
    candidateCount: Number(e.candidateCount),
    totalCommits: Number(e.totalCommits),
    totalReveals: Number(e.totalReveals),
  };
}

export async function fetchAllCandidates(electionId) {
  const provider = await getProvider();
  const contract = await getContract(provider);
  const result = await contract.getAllCandidates(electionId);
  const ids = result[0], names = result[1], parties = result[2], votes = result[3];
  return ids.map((id, i) => ({
    id: Number(id),
    name: names[i],
    party: parties[i],
    voteCount: Number(votes[i]),
  }));
}

export async function fetchVoterStatus(electionId, address) {
  const provider = await getProvider();
  const contract = await getContract(provider);
  const result = await contract.getVoterStatus(electionId, address);
  return { hasCommitted: result[0], hasRevealed: result[1] };
}

export async function fetchWinner(electionId) {
  const provider = await getProvider();
  const contract = await getContract(provider);
  const result = await contract.getWinner(electionId);
  return {
    id: Number(result.winnerId),
    name: result.winnerName,
    party: result.winnerParty,
    votes: Number(result.winnerVotes),
  };
}

export async function fetchElectionCount() {
  const provider = await getProvider();
  const contract = await getContract(provider);
  return Number(await contract.electionCount());
}

export function shortenAddress(addr) {
  if (!addr) return '';
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}
