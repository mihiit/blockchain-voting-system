# VoteChain — Blockchain-Based Secure Voting System

**B.Tech CSE Project | IILM University, Greater Noida**
Built with Ethereum · Solidity · Hardhat · React.js · Ethers.js · MetaMask

---

## Project Structure

```
blockchain-voting/
├── contracts/
│   └── VotingSystem.sol          # Solidity smart contract
├── scripts/
│   └── deploy.js                 # Deployment script
├── test/
│   └── VotingSystem.test.js      # 10 unit tests (Chai + Hardhat)
├── hardhat.config.js
├── package.json
└── frontend/
    ├── public/index.html
    ├── package.json
    └── src/
        ├── App.js / App.module.css
        ├── index.js / index.css
        ├── components/
        │   ├── Header.js/.css
        │   ├── Dashboard.js/.css
        │   ├── CreateElection.js/.css
        │   └── ElectionView.js/.css
        └── utils/
            ├── blockchain.js       # All ethers.js helpers
            └── contract.js         # ABI + address (auto-generated)
```

---

## Setup & Running (Step-by-Step)

### Prerequisites
- Node.js v18+ installed
- MetaMask browser extension installed
- Git (optional)

---

### Step 1 — Install Hardhat dependencies

```bash
cd blockchain-voting
npm install
```

---

### Step 2 — Compile the smart contract

```bash
npx hardhat compile
```

Expected output:
```
Compiled 1 Solidity file successfully
```

---

### Step 3 — Run tests

```bash
npx hardhat test
```

Expected: 10 passing tests covering election creation, candidates, phases, commit-reveal voting, and winner determination.

---

### Step 4 — Start local Hardhat blockchain node

Open **Terminal 1** and run:

```bash
npx hardhat node
```

This starts a local Ethereum network at `http://127.0.0.1:8545` with 20 funded test accounts.

**Important:** Copy one of the private keys printed in the output — you'll need it for MetaMask.

Example output:
```
Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

---

### Step 5 — Deploy the smart contract

Open **Terminal 2** and run:

```bash
npx hardhat run scripts/deploy.js --network localhost
```

Expected output:
```
Deploying with account: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
✅ VotingSystem deployed at: 0x5FbDB2315678afecb367f032d93F642f64180aa3
📁 Contract address + ABI saved to frontend/src/utils/contract.js
```

The deploy script automatically writes the contract address and ABI to `frontend/src/utils/contract.js`.

---

### Step 6 — Configure MetaMask

1. Open MetaMask → **Add a network manually**:
   - Network Name: `Hardhat Local`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency Symbol: `ETH`

2. **Import a test account**:
   - MetaMask → Account menu → **Import Account**
   - Paste the private key from Step 4 (Account #0)
   - Repeat for Account #1, #2, etc. to test with multiple voters

---

### Step 7 — Start the React frontend

```bash
cd frontend
npm install
npm start
```

Frontend opens at `http://localhost:3000`

---

## How to Use the Application

### As Admin (Account #0 — the deployer)

1. Connect MetaMask wallet
2. Click **Create Election** → Enter title and description
3. In the election page, **Add Candidates** (at least 2)
4. Click **Start Commit Phase** to open voting
5. When enough votes are in, click **Start Reveal Phase**
6. Click **End Election** to finalize and display winner

### As Voter (Any other account)

**Commit Phase:**
1. Connect a different MetaMask account (Account #1, #2, etc.)
2. Open the election
3. Select a candidate and enter a **secret phrase** (e.g. `mysecret123`)
4. ⚠️ **Write down your secret** — you need it to reveal
5. Check the confirmation box and click **Commit Vote**

**Reveal Phase:**
1. Select the same candidate you committed to
2. Enter the exact same secret phrase
3. Click **Reveal Vote** — your vote is now counted

---

## Smart Contract: Commit-Reveal Protocol

```
Commit:  hash = keccak256(abi.encodePacked(candidateId, secretBytes32))
         → Submit hash on-chain (vote stays hidden)

Reveal:  Submit candidateId + secret
         → Contract verifies: keccak256(candidateId, secret) == stored hash
         → If match: vote counted
```

This ensures:
- Votes are hidden during the commit phase (prevents influence)
- Votes are verifiable during reveal
- Invalid reveals (wrong candidate/secret) are rejected
- No double voting possible

---

## Election Phases

| Phase | Who acts | What happens |
|-------|----------|-------------|
| Created | Admin | Add candidates |
| Commit Phase | Voters | Submit encrypted vote hashes |
| Reveal Phase | Voters | Reveal vote with secret |
| Ended | — | Results final, winner displayed |

---

## Security Features

- **Commit-Reveal**: Votes hidden during voting period
- **One vote per wallet**: Smart contract enforces this on-chain
- **Phase gating**: Actions rejected outside correct phase
- **No centralized server**: All logic lives in the smart contract
- **Immutable results**: Once revealed, votes cannot be changed

---

## GitHub Repository

https://github.com/mihiit/

---
