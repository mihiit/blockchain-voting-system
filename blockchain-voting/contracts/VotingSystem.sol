// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title VotingSystem
 * @dev Blockchain-Based Secure Voting System with Commit-Reveal scheme
 * @author Mihit Nanda - IILM University
 *
 * Election Lifecycle:
 *   Created → CommitPhase → RevealPhase → Ended
 *
 * Commit-Reveal Privacy:
 *   Commit:  keccak256(abi.encodePacked(candidateId, secret))
 *   Reveal:  submit candidateId + secret → contract verifies hash
 */
contract VotingSystem {

    // ─────────────────────────────────────────────
    //  Enums & Structs
    // ─────────────────────────────────────────────

    enum Phase { Created, CommitPhase, RevealPhase, Ended }

    struct Candidate {
        uint256 id;
        string name;
        string party;
        uint256 voteCount;
        bool exists;
    }

    struct Election {
        uint256 id;
        string title;
        string description;
        address admin;
        Phase phase;
        uint256 candidateCount;
        uint256 totalCommits;
        uint256 totalReveals;
        bool exists;
    }

    struct VoterStatus {
        bool hasCommitted;
        bool hasRevealed;
        bytes32 commitHash;
    }

    // ─────────────────────────────────────────────
    //  State
    // ─────────────────────────────────────────────

    uint256 public electionCount;

    // electionId → Election
    mapping(uint256 => Election) public elections;

    // electionId → candidateId → Candidate
    mapping(uint256 => mapping(uint256 => Candidate)) public candidates;

    // electionId → voterAddress → VoterStatus
    mapping(uint256 => mapping(address => VoterStatus)) public voterStatuses;

    // ─────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────

    event ElectionCreated(uint256 indexed electionId, string title, address indexed admin);
    event CandidateAdded(uint256 indexed electionId, uint256 candidateId, string name);
    event PhaseChanged(uint256 indexed electionId, Phase newPhase);
    event VoteCommitted(uint256 indexed electionId, address indexed voter);
    event VoteRevealed(uint256 indexed electionId, address indexed voter, uint256 candidateId);

    // ─────────────────────────────────────────────
    //  Modifiers
    // ─────────────────────────────────────────────

    modifier onlyAdmin(uint256 _electionId) {
        require(elections[_electionId].exists, "Election does not exist");
        require(elections[_electionId].admin == msg.sender, "Only admin can perform this action");
        _;
    }

    modifier electionExists(uint256 _electionId) {
        require(elections[_electionId].exists, "Election does not exist");
        _;
    }

    modifier inPhase(uint256 _electionId, Phase _phase) {
        require(elections[_electionId].phase == _phase, "Action not allowed in current phase");
        _;
    }

    // ─────────────────────────────────────────────
    //  Election Management
    // ─────────────────────────────────────────────

    /**
     * @dev Create a new election. Caller becomes admin.
     */
    function createElection(string calldata _title, string calldata _description)
        external
        returns (uint256)
    {
        require(bytes(_title).length > 0, "Title cannot be empty");
        electionCount++;
        elections[electionCount] = Election({
            id: electionCount,
            title: _title,
            description: _description,
            admin: msg.sender,
            phase: Phase.Created,
            candidateCount: 0,
            totalCommits: 0,
            totalReveals: 0,
            exists: true
        });
        emit ElectionCreated(electionCount, _title, msg.sender);
        return electionCount;
    }

    /**
     * @dev Add a candidate. Only admin, only in Created phase.
     */
    function addCandidate(uint256 _electionId, string calldata _name, string calldata _party)
        external
        onlyAdmin(_electionId)
        inPhase(_electionId, Phase.Created)
    {
        require(bytes(_name).length > 0, "Candidate name cannot be empty");
        Election storage election = elections[_electionId];
        election.candidateCount++;
        candidates[_electionId][election.candidateCount] = Candidate({
            id: election.candidateCount,
            name: _name,
            party: _party,
            voteCount: 0,
            exists: true
        });
        emit CandidateAdded(_electionId, election.candidateCount, _name);
    }

    /**
     * @dev Advance election to next phase.
     *      Created → CommitPhase (requires ≥ 2 candidates)
     *      CommitPhase → RevealPhase
     *      RevealPhase → Ended
     */
    function advancePhase(uint256 _electionId)
        external
        onlyAdmin(_electionId)
    {
        Election storage election = elections[_electionId];
        if (election.phase == Phase.Created) {
            require(election.candidateCount >= 2, "Need at least 2 candidates to start");
            election.phase = Phase.CommitPhase;
        } else if (election.phase == Phase.CommitPhase) {
            require(election.totalCommits > 0, "No votes committed yet");
            election.phase = Phase.RevealPhase;
        } else if (election.phase == Phase.RevealPhase) {
            election.phase = Phase.Ended;
        } else {
            revert("Election already ended");
        }
        emit PhaseChanged(_electionId, election.phase);
    }

    // ─────────────────────────────────────────────
    //  Voting — Commit Phase
    // ─────────────────────────────────────────────

    /**
     * @dev Commit a vote. Voter submits hash = keccak256(candidateId, secret).
     * @param _electionId  Target election
     * @param _commitHash  keccak256(abi.encodePacked(candidateId, secret))
     */
    function commitVote(uint256 _electionId, bytes32 _commitHash)
        external
        electionExists(_electionId)
        inPhase(_electionId, Phase.CommitPhase)
    {
        VoterStatus storage voter = voterStatuses[_electionId][msg.sender];
        require(!voter.hasCommitted, "You have already committed a vote");
        require(_commitHash != bytes32(0), "Invalid commit hash");

        voter.hasCommitted = true;
        voter.commitHash = _commitHash;
        elections[_electionId].totalCommits++;

        emit VoteCommitted(_electionId, msg.sender);
    }

    // ─────────────────────────────────────────────
    //  Voting — Reveal Phase
    // ─────────────────────────────────────────────

    /**
     * @dev Reveal a vote. Voter submits original candidateId + secret.
     *      Contract verifies: keccak256(candidateId, secret) == stored hash.
     * @param _electionId   Target election
     * @param _candidateId  Candidate chosen during commit
     * @param _secret       Secret used during commit (as bytes32)
     */
    function revealVote(uint256 _electionId, uint256 _candidateId, bytes32 _secret)
        external
        electionExists(_electionId)
        inPhase(_electionId, Phase.RevealPhase)
    {
        VoterStatus storage voter = voterStatuses[_electionId][msg.sender];
        require(voter.hasCommitted, "You have not committed a vote");
        require(!voter.hasRevealed, "You have already revealed your vote");
        require(candidates[_electionId][_candidateId].exists, "Invalid candidate");

        // Verify the hash
        bytes32 expectedHash = keccak256(abi.encodePacked(_candidateId, _secret));
        require(expectedHash == voter.commitHash, "Hash mismatch: invalid reveal");

        voter.hasRevealed = true;
        candidates[_electionId][_candidateId].voteCount++;
        elections[_electionId].totalReveals++;

        emit VoteRevealed(_electionId, msg.sender, _candidateId);
    }

    // ─────────────────────────────────────────────
    //  View Functions
    // ─────────────────────────────────────────────

    function getElection(uint256 _electionId)
        external
        view
        electionExists(_electionId)
        returns (
            uint256 id, string memory title, string memory description,
            address admin, Phase phase, uint256 candidateCount,
            uint256 totalCommits, uint256 totalReveals
        )
    {
        Election storage e = elections[_electionId];
        return (e.id, e.title, e.description, e.admin, e.phase, e.candidateCount, e.totalCommits, e.totalReveals);
    }

    function getCandidate(uint256 _electionId, uint256 _candidateId)
        external
        view
        electionExists(_electionId)
        returns (uint256 id, string memory name, string memory party, uint256 voteCount)
    {
        Candidate storage c = candidates[_electionId][_candidateId];
        require(c.exists, "Candidate does not exist");
        return (c.id, c.name, c.party, c.voteCount);
    }

    function getAllCandidates(uint256 _electionId)
        external
        view
        electionExists(_electionId)
        returns (uint256[] memory ids, string[] memory names, string[] memory parties, uint256[] memory voteCounts)
    {
        uint256 count = elections[_electionId].candidateCount;
        ids = new uint256[](count);
        names = new string[](count);
        parties = new string[](count);
        voteCounts = new uint256[](count);
        for (uint256 i = 1; i <= count; i++) {
            Candidate storage c = candidates[_electionId][i];
            ids[i-1] = c.id;
            names[i-1] = c.name;
            parties[i-1] = c.party;
            voteCounts[i-1] = c.voteCount;
        }
    }

    function getVoterStatus(uint256 _electionId, address _voter)
        external
        view
        electionExists(_electionId)
        returns (bool hasCommitted, bool hasRevealed)
    {
        VoterStatus storage v = voterStatuses[_electionId][_voter];
        return (v.hasCommitted, v.hasRevealed);
    }

    function getWinner(uint256 _electionId)
        external
        view
        electionExists(_electionId)
        inPhase(_electionId, Phase.Ended)
        returns (uint256 winnerId, string memory winnerName, string memory winnerParty, uint256 winnerVotes)
    {
        uint256 count = elections[_electionId].candidateCount;
        uint256 maxVotes = 0;
        uint256 winId = 0;
        for (uint256 i = 1; i <= count; i++) {
            if (candidates[_electionId][i].voteCount > maxVotes) {
                maxVotes = candidates[_electionId][i].voteCount;
                winId = i;
            }
        }
        require(winId != 0, "No votes revealed");
        Candidate storage w = candidates[_electionId][winId];
        return (w.id, w.name, w.party, w.voteCount);
    }

    /**
     * @dev Helper to generate commit hash off-chain (same logic as on-chain verify).
     */
    function generateCommitHash(uint256 _candidateId, bytes32 _secret)
        external
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(_candidateId, _secret));
    }
}
