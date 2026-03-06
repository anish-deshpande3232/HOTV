// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ProvenanceTracker
 * @dev Blockchain-based provenance and authenticity platform for Agriculture & Pharma supply chains
 * @notice Tracks products from Producer → Middleman → Warehouse → Lab → Admin → Transport → End User
 */
contract ProvenanceTracker {

    // ─────────────────────────────────────────────
    //  ENUMS
    // ─────────────────────────────────────────────

    enum Role {
        Producer,
        Middleman,
        Warehouse,
        Lab,
        Admin,
        Transport
    }

    enum IndustryType {
        Agriculture,
        Pharmaceutical
    }

    enum BatchStatus {
        Created,
        InTransit,
        InWarehouse,
        LabVerified,
        Approved,
        Delivered
    }

    // ─────────────────────────────────────────────
    //  STRUCTS
    // ─────────────────────────────────────────────

    struct User {
        address wallet;
        Role role;
        string name;
        bool isRegistered;
        uint256 registeredAt;
    }

    struct Batch {
        bytes32 batchId;
        IndustryType industryType;
        address currentOwner;
        string metadataHash;      // IPFS hash of metadata JSON
        string photoHash;         // IPFS hash of initial photo
        uint256 createdAt;
        BatchStatus status;
        bool exists;
    }

    struct EventLog {
        bytes32 batchId;
        Role role;
        address actor;
        string metadataHash;
        string photoHash;
        string action;
        uint256 timestamp;
    }

    // ─────────────────────────────────────────────
    //  STATE VARIABLES
    // ─────────────────────────────────────────────

    address public owner;
    mapping(address => User) public users;
    mapping(bytes32 => Batch) public batches;
    mapping(bytes32 => EventLog[]) public batchHistory;
    bytes32[] public allBatchIds;

    uint256 private batchCounter;

    // ─────────────────────────────────────────────
    //  EVENTS
    // ─────────────────────────────────────────────

    event UserRegistered(address indexed wallet, Role role, string name);
    event BatchCreated(bytes32 indexed batchId, address indexed producer, IndustryType industryType);
    event CustodyAccepted(bytes32 indexed batchId, address indexed middleman);
    event BatchStored(bytes32 indexed batchId, address indexed warehouse);
    event LabResultUploaded(bytes32 indexed batchId, address indexed lab, string resultHash);
    event BatchApproved(bytes32 indexed batchId, address indexed admin);
    event BatchTransported(bytes32 indexed batchId, address indexed transport);
    event BatchDelivered(bytes32 indexed batchId, address indexed transport);

    // ─────────────────────────────────────────────
    //  MODIFIERS
    // ─────────────────────────────────────────────

    modifier onlyRegistered() {
        require(users[msg.sender].isRegistered, "User not registered");
        _;
    }

    modifier onlyRole(Role _role) {
        require(
    users[msg.sender].role == _role || users[msg.sender].role == Role.Admin,
    "Not authorized"
);
        _;
    }

    modifier batchExists(bytes32 _batchId) {
        require(batches[_batchId].exists, "Batch does not exist");
        _;
    }

    // ─────────────────────────────────────────────
    //  CONSTRUCTOR
    // ─────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
        // Register deployer as Admin
        users[msg.sender] = User({
            wallet: msg.sender,
            role: Role.Admin,
            name: "Platform Admin",
            isRegistered: true,
            registeredAt: block.timestamp
        });
    }

    // ─────────────────────────────────────────────
    //  USER MANAGEMENT
    // ─────────────────────────────────────────────

    /**
     * @dev Register a new user with a specific role
     * @param _role The role to assign to the user
     * @param _name Display name for the user
     */
    function registerUser(Role _role, string calldata _name) external {
        require(!users[msg.sender].isRegistered, "Already registered");
        require(bytes(_name).length > 0, "Name required");

        users[msg.sender] = User({
            wallet: msg.sender,
            role: _role,
            name: _name,
            isRegistered: true,
            registeredAt: block.timestamp
        });

        emit UserRegistered(msg.sender, _role, _name);
    }

    // ─────────────────────────────────────────────
    //  BATCH LIFECYCLE FUNCTIONS
    // ─────────────────────────────────────────────

    /**
     * @dev Producer creates a new batch
     * @param _industryType Agriculture or Pharmaceutical
     * @param _metadataHash IPFS hash of batch metadata JSON
     * @param _photoHash IPFS hash of initial product photo
     */
    function createBatch(
        IndustryType _industryType,
        string calldata _metadataHash,
        string calldata _photoHash
    ) external onlyRole(Role.Producer) returns (bytes32) {
        batchCounter++;
        bytes32 batchId = keccak256(abi.encodePacked(
            msg.sender,
            block.timestamp,
            batchCounter
        ));

        batches[batchId] = Batch({
            batchId: batchId,
            industryType: _industryType,
            currentOwner: msg.sender,
            metadataHash: _metadataHash,
            photoHash: _photoHash,
            createdAt: block.timestamp,
            status: BatchStatus.Created,
            exists: true
        });

        allBatchIds.push(batchId);

        _appendLog(batchId, Role.Producer, _metadataHash, _photoHash, "BATCH_CREATED");

        emit BatchCreated(batchId, msg.sender, _industryType);
        return batchId;
    }

    /**
     * @dev Middleman accepts custody of a batch
     * @param _batchId The batch to accept
     * @param _metadataHash IPFS hash of pickup metadata
     * @param _photoHash IPFS hash of pickup photo proof
     */
    function acceptCustody(
        bytes32 _batchId,
        string calldata _metadataHash,
        string calldata _photoHash
    ) external onlyRole(Role.Middleman) batchExists(_batchId) {
        Batch storage batch = batches[_batchId];
        require(batch.status == BatchStatus.Created, "Invalid batch status");

        batch.currentOwner = msg.sender;
        batch.status = BatchStatus.InTransit;
        batch.metadataHash = _metadataHash;

        _appendLog(_batchId, Role.Middleman, _metadataHash, _photoHash, "CUSTODY_ACCEPTED");

        emit CustodyAccepted(_batchId, msg.sender);
    }

    /**
     * @dev Warehouse stores a batch
     * @param _batchId The batch to store
     * @param _metadataHash IPFS hash of storage metadata
     * @param _photoHash IPFS hash of storage proof photo
     */
    function storeWarehouse(
        bytes32 _batchId,
        string calldata _metadataHash,
        string calldata _photoHash
    ) external onlyRole(Role.Warehouse) batchExists(_batchId) {
        Batch storage batch = batches[_batchId];
        require(batch.status == BatchStatus.InTransit, "Batch not in transit");

        batch.currentOwner = msg.sender;
        batch.status = BatchStatus.InWarehouse;
        batch.metadataHash = _metadataHash;

        _appendLog(_batchId, Role.Warehouse, _metadataHash, _photoHash, "STORED_IN_WAREHOUSE");

        emit BatchStored(_batchId, msg.sender);
    }

    /**
     * @dev Lab uploads test results for a batch
     * @param _batchId The batch being tested
     * @param _resultHash IPFS hash of lab result report
     * @param _photoHash IPFS hash of lab test photos
     */
    function uploadLabResult(
        bytes32 _batchId,
        string calldata _resultHash,
        string calldata _photoHash
    ) external onlyRole(Role.Lab) batchExists(_batchId) {
        Batch storage batch = batches[_batchId];
        require(batch.status == BatchStatus.InWarehouse, "Batch not in warehouse");

        batch.currentOwner = msg.sender;
        batch.status = BatchStatus.LabVerified;
        batch.metadataHash = _resultHash;

        _appendLog(_batchId, Role.Lab, _resultHash, _photoHash, "LAB_RESULT_UPLOADED");

        emit LabResultUploaded(_batchId, msg.sender, _resultHash);
    }

    /**
     * @dev Admin approves a lab-verified batch
     * @param _batchId The batch to approve
     * @param _metadataHash IPFS hash of approval metadata
     */
    function adminApprove(
        bytes32 _batchId,
        string calldata _metadataHash
    ) external onlyRole(Role.Admin) batchExists(_batchId) {
        Batch storage batch = batches[_batchId];
        require(batch.status == BatchStatus.LabVerified, "Batch not lab verified");

        batch.currentOwner = msg.sender;
        batch.status = BatchStatus.Approved;
        batch.metadataHash = _metadataHash;

        _appendLog(_batchId, Role.Admin, _metadataHash, "", "ADMIN_APPROVED");

        emit BatchApproved(_batchId, msg.sender);
    }

    /**
     * @dev Transport picks up an approved batch
     * @param _batchId The batch to transport
     * @param _metadataHash IPFS hash of transport metadata
     * @param _photoHash IPFS hash of pickup proof photo
     */
    function transportBatch(
        bytes32 _batchId,
        string calldata _metadataHash,
        string calldata _photoHash
    ) external onlyRole(Role.Transport) batchExists(_batchId) {
        Batch storage batch = batches[_batchId];
        require(batch.status == BatchStatus.Approved, "Batch not approved");

        batch.currentOwner = msg.sender;
        batch.status = BatchStatus.InTransit;
        batch.metadataHash = _metadataHash;

        _appendLog(_batchId, Role.Transport, _metadataHash, _photoHash, "TRANSPORT_STARTED");

        emit BatchTransported(_batchId, msg.sender);
    }

    /**
     * @dev Transport marks batch as delivered
     * @param _batchId The batch delivered
     * @param _metadataHash IPFS hash of delivery metadata
     * @param _photoHash IPFS hash of delivery proof photo
     */
    function deliverBatch(
        bytes32 _batchId,
        string calldata _metadataHash,
        string calldata _photoHash
    ) external onlyRole(Role.Transport) batchExists(_batchId) {
        Batch storage batch = batches[_batchId];
        require(batch.status == BatchStatus.InTransit, "Batch not in transit");
        require(batch.currentOwner == msg.sender, "Not current owner");

        batch.status = BatchStatus.Delivered;
        batch.metadataHash = _metadataHash;

        _appendLog(_batchId, Role.Transport, _metadataHash, _photoHash, "DELIVERED");

        emit BatchDelivered(_batchId, msg.sender);
    }

    // ─────────────────────────────────────────────
    //  VIEW FUNCTIONS
    // ─────────────────────────────────────────────

    /**
     * @dev Get full history of a batch
     * @param _batchId The batch to query
     */
    function getBatchHistory(bytes32 _batchId)
        external
        view
        batchExists(_batchId)
        returns (EventLog[] memory)
    {
        return batchHistory[_batchId];
    }

    /**
     * @dev Get batch details
     */
    function getBatch(bytes32 _batchId)
        external
        view
        batchExists(_batchId)
        returns (Batch memory)
    {
        return batches[_batchId];
    }

    /**
     * @dev Verify a batch and return its current status
     */
    function verifyBatch(bytes32 _batchId)
        external
        view
        returns (bool exists, BatchStatus status, address currentOwner, uint256 eventCount)
    {
        if (!batches[_batchId].exists) {
            return (false, BatchStatus.Created, address(0), 0);
        }
        Batch storage b = batches[_batchId];
        return (true, b.status, b.currentOwner, batchHistory[_batchId].length);
    }

    /**
     * @dev Get all batch IDs
     */
    function getAllBatchIds() external view returns (bytes32[] memory) {
        return allBatchIds;
    }

    /**
     * @dev Get user info
     */
    function getUser(address _wallet) external view returns (User memory) {
        return users[_wallet];
    }

    // ─────────────────────────────────────────────
    //  INTERNAL HELPERS
    // ─────────────────────────────────────────────

    function _appendLog(
        bytes32 _batchId,
        Role _role,
        string memory _metadataHash,
        string memory _photoHash,
        string memory _action
    ) internal {
        batchHistory[_batchId].push(EventLog({
            batchId: _batchId,
            role: _role,
            actor: msg.sender,
            metadataHash: _metadataHash,
            photoHash: _photoHash,
            action: _action,
            timestamp: block.timestamp
        }));
    }
}
