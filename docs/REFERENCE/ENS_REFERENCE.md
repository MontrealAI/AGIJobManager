# ENS Reference (Generated)

Source fingerprint (sha256, 16 hex): d08224a681e50944

Source files used:
- `contracts/AGIJobManager.sol`
- `contracts/utils/ENSOwnership.sol`
- `contracts/ens/ENSJobPages.sol`
- `contracts/ens/IENSJobPages.sol`

## ENS surface area

- `bytes32 public clubRootNode;` (contracts/AGIJobManager.sol:135)
- `bytes32 public alphaClubRootNode;` (contracts/AGIJobManager.sol:136)
- `bytes32 public agentRootNode;` (contracts/AGIJobManager.sol:137)
- `bytes32 public alphaAgentRootNode;` (contracts/AGIJobManager.sol:138)
- `bytes32 public validatorMerkleRoot;` (contracts/AGIJobManager.sol:139)
- `bytes32 public agentMerkleRoot;` (contracts/AGIJobManager.sol:140)
- `ENS public ens;` (contracts/AGIJobManager.sol:141)
- `NameWrapper public nameWrapper;` (contracts/AGIJobManager.sol:142)
- `address public ensJobPages;` (contracts/AGIJobManager.sol:143)
- `bool public lockIdentityConfig;` (contracts/AGIJobManager.sol:146)
- `IENSRegistry public ens;` (contracts/ens/ENSJobPages.sol:58)
- `INameWrapper public nameWrapper;` (contracts/ens/ENSJobPages.sol:59)
- `IPublicResolver public publicResolver;` (contracts/ens/ENSJobPages.sol:60)
- `bytes32 public jobsRootNode;` (contracts/ens/ENSJobPages.sol:61)
- `string public jobsRootName;` (contracts/ens/ENSJobPages.sol:62)
- `address public jobManager;` (contracts/ens/ENSJobPages.sol:63)
- `bool public useEnsJobTokenURI;` (contracts/ens/ENSJobPages.sol:64)

## Config and locks

- `function _initRoots(bytes32[4] memory rootNodes, bytes32[2] memory merkleRoots) internal` (contracts/AGIJobManager.sol:320)
- `function lockIdentityConfiguration() external onlyOwner whenIdentityConfigurable` (contracts/AGIJobManager.sol:463)
- `function applyForJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof)` (contracts/AGIJobManager.sol:494)
- `function validateJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof)` (contracts/AGIJobManager.sol:556)
- `function disapproveJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof)` (contracts/AGIJobManager.sol:564)
- `function updateAGITokenAddress(address _newTokenAddress) external onlyOwner whenIdentityConfigurable` (contracts/AGIJobManager.sol:729)
- `function updateEnsRegistry(address _newEnsRegistry) external onlyOwner whenIdentityConfigurable` (contracts/AGIJobManager.sol:736)
- `function updateNameWrapper(address _newNameWrapper) external onlyOwner whenIdentityConfigurable` (contracts/AGIJobManager.sol:742)
- `function setEnsJobPages(address _ensJobPages) external onlyOwner whenIdentityConfigurable` (contracts/AGIJobManager.sol:748)
- `function updateRootNodes(` (contracts/AGIJobManager.sol:757)
- `function updateMerkleRoots(bytes32 _validatorMerkleRoot, bytes32 _agentMerkleRoot) external onlyOwner` (contracts/AGIJobManager.sol:770)
- `function lockJobENS(uint256 jobId, bool burnFuses) external` (contracts/AGIJobManager.sol:981)
- `function tokenURI(uint256 tokenId) public view override returns (string memory)` (contracts/AGIJobManager.sol:1217)
- `function _callEnsJobPagesHook(uint8 hook, uint256 jobId) internal` (contracts/AGIJobManager.sol:1222)
- `function _verifyOwnershipByRoot(address claimant, string memory subdomain, bytes32 rootNode) internal view returns (bool)` (contracts/AGIJobManager.sol:1250)
- `function verifyENSOwnership(` (contracts/utils/ENSOwnership.sol:12)
- `function setENSRegistry(address ensAddress) external onlyOwner` (contracts/ens/ENSJobPages.sol:83)
- `function setNameWrapper(address nameWrapperAddress) external onlyOwner` (contracts/ens/ENSJobPages.sol:90)
- `function setJobsRoot(bytes32 rootNode, string calldata rootName) external onlyOwner` (contracts/ens/ENSJobPages.sol:104)
- `function handleHook(uint8 hook, uint256 jobId) external onlyJobManager` (contracts/ens/ENSJobPages.sol:166)
- `function lockJobENS(uint256 jobId, address employer, address agent, bool burnFuses) public onlyOwner` (contracts/ens/ENSJobPages.sol:255)
- `function _lockJobENS(uint256 jobId, address employer, address agent, bool burnFuses) internal` (contracts/ens/ENSJobPages.sol:260)

## Events and errors

- `error NotAuthorized();` (contracts/AGIJobManager.sol:74)
- `error InvalidParameters();` (contracts/AGIJobManager.sol:76)
- `error ConfigLocked();` (contracts/AGIJobManager.sol:85)
- `event EnsRegistryUpdated(address newEnsRegistry);` (contracts/AGIJobManager.sol:218)
- `event RootNodesUpdated(` (contracts/AGIJobManager.sol:220)
- `event MerkleRootsUpdated(bytes32 validatorMerkleRoot, bytes32 agentMerkleRoot);` (contracts/AGIJobManager.sol:226)
- `event IdentityConfigurationLocked(address indexed locker, uint256 indexed atTimestamp);` (contracts/AGIJobManager.sol:233)
- `event EnsJobPagesUpdated(address indexed oldEnsJobPages, address indexed newEnsJobPages);` (contracts/AGIJobManager.sol:240)
- `event EnsHookAttempted(uint8 indexed hook, uint256 indexed jobId, address indexed target, bool success);` (contracts/AGIJobManager.sol:255)
- `error ENSNotConfigured();` (contracts/ens/ENSJobPages.sol:34)
- `error ENSNotAuthorized();` (contracts/ens/ENSJobPages.sol:35)
- `error InvalidParameters();` (contracts/ens/ENSJobPages.sol:36)
- `event JobENSPageCreated(uint256 indexed jobId, bytes32 indexed node);` (contracts/ens/ENSJobPages.sol:43)
- `event JobENSPermissionsUpdated(uint256 indexed jobId, address indexed account, bool isAuthorised);` (contracts/ens/ENSJobPages.sol:44)
- `event JobENSLocked(uint256 indexed jobId, bytes32 indexed node, bool fusesBurned);` (contracts/ens/ENSJobPages.sol:45)
- `event ENSRegistryUpdated(address indexed oldEns, address indexed newEns);` (contracts/ens/ENSJobPages.sol:46)
- `event UseEnsJobTokenURIUpdated(bool oldValue, bool newValue);` (contracts/ens/ENSJobPages.sol:56)

## Notes / caveats from code comments

- @notice Total AGI locked as agent performance bonds for unsettled jobs. (contracts/AGIJobManager.sol:127)
- @notice Total AGI locked as validator bonds for unsettled votes. (contracts/AGIJobManager.sol:129)
- @notice Total AGI locked as dispute bonds for unsettled disputes. (contracts/AGIJobManager.sol:131)
- @notice Freezes token/ENS/namewrapper/root nodes. Not a governance lock; ops remain owner-controlled. (contracts/AGIJobManager.sol:145)
- @notice Anyone may lock ENS records after a job reaches a terminal state; only the owner may burn fuses. (contracts/AGIJobManager.sol:979)
- @dev Fuse burning is irreversible and remains owner-only; ENS hook execution is best-effort. (contracts/AGIJobManager.sol:980)
- @dev as long as lockedEscrow/locked*Bonds are fully covered. (contracts/AGIJobManager.sol:1027)
- @dev Owner withdrawals are limited to balances not backing lockedEscrow/locked*Bonds. (contracts/AGIJobManager.sol:1269)

