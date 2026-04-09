const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VotingSystem", function () {
  let voting, admin, voter1, voter2, voter3;

  beforeEach(async () => {
    [admin, voter1, voter2, voter3] = await ethers.getSigners();
    const VotingSystem = await ethers.getContractFactory("VotingSystem");
    voting = await VotingSystem.deploy();
  });

  // ─── Helpers ────────────────────────────────────────────
  async function createElectionWithCandidates() {
    await voting.connect(admin).createElection("Test Election", "Description");
    await voting.connect(admin).addCandidate(1, "Alice", "Party A");
    await voting.connect(admin).addCandidate(1, "Bob", "Party B");
    return 1;
  }

  function makeCommitHash(candidateId, secret) {
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "bytes32"],
        [candidateId, ethers.encodeBytes32String(secret)]
      )
    );
  }

  // Use the contract's own hash function (matches Solidity: abi.encodePacked)
  async function contractHash(candidateId, secret) {
    const secretBytes = ethers.encodeBytes32String(secret);
    return await voting.generateCommitHash(candidateId, secretBytes);
  }

  // ─── Election Creation ──────────────────────────────────
  describe("Election Creation", () => {
    it("should create an election", async () => {
      await voting.connect(admin).createElection("My Election", "Desc");
      const e = await voting.getElection(1);
      expect(e.title).to.equal("My Election");
      expect(e.admin).to.equal(admin.address);
      expect(e.phase).to.equal(0); // Created
    });

    it("should reject empty title", async () => {
      await expect(voting.createElection("", "Desc")).to.be.revertedWith("Title cannot be empty");
    });

    it("should increment electionCount", async () => {
      await voting.createElection("E1", "D");
      await voting.createElection("E2", "D");
      expect(await voting.electionCount()).to.equal(2);
    });
  });

  // ─── Candidate Management ────────────────────────────────
  describe("Candidate Management", () => {
    it("should add candidates", async () => {
      await voting.createElection("E", "D");
      await voting.addCandidate(1, "Alice", "Party A");
      const c = await voting.getCandidate(1, 1);
      expect(c.name).to.equal("Alice");
      expect(c.party).to.equal("Party A");
    });

    it("should reject non-admin adding candidates", async () => {
      await voting.createElection("E", "D");
      await expect(voting.connect(voter1).addCandidate(1, "X", "Y"))
        .to.be.revertedWith("Only admin can perform this action");
    });

    it("should reject adding candidates after phase change", async () => {
      const id = await createElectionWithCandidates();
      await voting.connect(admin).advancePhase(id);
      await expect(voting.connect(admin).addCandidate(id, "Charlie", "C"))
        .to.be.revertedWith("Action not allowed in current phase");
    });
  });

  // ─── Phase Transitions ──────────────────────────────────
  describe("Phase Transitions", () => {
    it("should require 2 candidates before starting commit phase", async () => {
      await voting.createElection("E", "D");
      await voting.addCandidate(1, "Alice", "A");
      await expect(voting.advancePhase(1)).to.be.revertedWith("Need at least 2 candidates to start");
    });

    it("should transition through all phases", async () => {
      const id = await createElectionWithCandidates();
      await voting.advancePhase(id); // → CommitPhase

      const secret = ethers.encodeBytes32String("mysecret");
      const hash = await voting.generateCommitHash(1, secret);
      await voting.connect(voter1).commitVote(id, hash);

      await voting.advancePhase(id); // → RevealPhase
      await voting.advancePhase(id); // → Ended

      const e = await voting.getElection(id);
      expect(e.phase).to.equal(3); // Ended
    });
  });

  // ─── Commit–Reveal Voting ────────────────────────────────
  describe("Commit-Reveal Voting", () => {
    it("should allow commit and reveal with correct hash", async () => {
      const id = await createElectionWithCandidates();
      await voting.advancePhase(id); // → CommitPhase

      const secret = ethers.encodeBytes32String("secret1");
      const hash = await voting.generateCommitHash(1, secret);
      // Measure COMMIT gas
       const txCommit = await voting.connect(voter1).commitVote(id, hash);
       const receiptCommit = await txCommit.wait();
       console.log("Commit Gas:", receiptCommit.gasUsed.toString());

      await voting.advancePhase(id); // → RevealPhase
      // Measure REVEAL gas
       const txReveal = await voting.connect(voter1).revealVote(id, 1, secret);
       const receiptReveal = await txReveal.wait();
       console.log("Reveal Gas:", receiptReveal.gasUsed.toString());  

      const c = await voting.getCandidate(id, 1);
      expect(c.voteCount).to.equal(1);
    });

    it("should reject double commit", async () => {
      const id = await createElectionWithCandidates();
      await voting.advancePhase(id);

      const secret = ethers.encodeBytes32String("s");
      const hash = await voting.generateCommitHash(1, secret);
      await voting.connect(voter1).commitVote(id, hash);
      await expect(voting.connect(voter1).commitVote(id, hash))
        .to.be.revertedWith("You have already committed a vote");
    });

    it("should reject reveal with wrong secret", async () => {
      const id = await createElectionWithCandidates();
      await voting.advancePhase(id);

      const secret = ethers.encodeBytes32String("correct");
      const hash = await voting.generateCommitHash(1, secret);
      await voting.connect(voter1).commitVote(id, hash);

      await voting.advancePhase(id);
      const wrongSecret = ethers.encodeBytes32String("wrong");
      await expect(voting.connect(voter1).revealVote(id, 1, wrongSecret))
        .to.be.revertedWith("Hash mismatch: invalid reveal");
    });

    it("should reject reveal with wrong candidateId", async () => {
      const id = await createElectionWithCandidates();
      await voting.advancePhase(id);

      const secret = ethers.encodeBytes32String("s");
      const hash = await voting.generateCommitHash(1, secret);
      await voting.connect(voter1).commitVote(id, hash);

      await voting.advancePhase(id);
      await expect(voting.connect(voter1).revealVote(id, 2, secret))
        .to.be.revertedWith("Hash mismatch: invalid reveal");
    });

    it("should reject double reveal", async () => {
      const id = await createElectionWithCandidates();
      await voting.advancePhase(id);

      const secret = ethers.encodeBytes32String("s");
      const hash = await voting.generateCommitHash(1, secret);
      await voting.connect(voter1).commitVote(id, hash);
      await voting.advancePhase(id);
      await voting.connect(voter1).revealVote(id, 1, secret);
      await expect(voting.connect(voter1).revealVote(id, 1, secret))
        .to.be.revertedWith("You have already revealed your vote");
    });
  });

  // ─── Winner ──────────────────────────────────────────────
  describe("Winner", () => {
    it("should correctly determine winner", async () => {
      const id = await createElectionWithCandidates();
      await voting.advancePhase(id);

      const s1 = ethers.encodeBytes32String("s1");
      const s2 = ethers.encodeBytes32String("s2");
      const s3 = ethers.encodeBytes32String("s3");

      await voting.connect(voter1).commitVote(id, await voting.generateCommitHash(1, s1));
      await voting.connect(voter2).commitVote(id, await voting.generateCommitHash(1, s2));
      await voting.connect(voter3).commitVote(id, await voting.generateCommitHash(2, s3));

      await voting.advancePhase(id);
      await voting.connect(voter1).revealVote(id, 1, s1);
      await voting.connect(voter2).revealVote(id, 1, s2);
      await voting.connect(voter3).revealVote(id, 2, s3);

      await voting.advancePhase(id);
      const winner = await voting.getWinner(id);
      expect(winner.winnerName).to.equal("Alice");
      expect(winner.winnerVotes).to.equal(2);
    });
  });
});
