# ENS Reference (Generated)

Generated at (UTC): 2026-02-16T00:11:15-05:00

Source fingerprint: 72c3b81ccb3ea16c

Source files used:
- `contracts/AGIJobManager.sol`
- `contracts/utils/ENSOwnership.sol`
- `contracts/ens/ENSJobPages.sol`
- `contracts/ens/IENSJobPages.sol`

## ENS surface area

- `bytes32 public clubRootNode;` (contracts/AGIJobManager.sol:136)
- `bytes32 public alphaClubRootNode;` (contracts/AGIJobManager.sol:137)
- `bytes32 public agentRootNode;` (contracts/AGIJobManager.sol:138)
- `bytes32 public alphaAgentRootNode;` (contracts/AGIJobManager.sol:139)
- `bytes32 public validatorMerkleRoot;` (contracts/AGIJobManager.sol:140)
- `bytes32 public agentMerkleRoot;` (contracts/AGIJobManager.sol:141)
- `ENS public ens;` (contracts/AGIJobManager.sol:142)
- `NameWrapper public nameWrapper;` (contracts/AGIJobManager.sol:143)
- `address public ensJobPages;` (contracts/AGIJobManager.sol:144)
- `bool public lockIdentityConfig;` (contracts/AGIJobManager.sol:147)
- `IENSRegistry public ens;` (contracts/ens/ENSJobPages.sol:71)
- `INameWrapper public nameWrapper;` (contracts/ens/ENSJobPages.sol:72)
- `IPublicResolver public publicResolver;` (contracts/ens/ENSJobPages.sol:73)
- `bytes32 public jobsRootNode;` (contracts/ens/ENSJobPages.sol:74)
- `string public jobsRootName;` (contracts/ens/ENSJobPages.sol:75)
- `address public jobManager;` (contracts/ens/ENSJobPages.sol:76)
- `bool public useEnsJobTokenURI;` (contracts/ens/ENSJobPages.sol:77)
- `bool public configLocked;` (contracts/ens/ENSJobPages.sol:78)

## Config and locks

- `function _initRoots(bytes32[4] memory rootNodes, bytes32[2] memory merkleRoots) internal` (contracts/AGIJobManager.sol:322)
- `function lockIdentityConfiguration() external onlyOwner whenIdentityConfigurable` (contracts/AGIJobManager.sol:480)
- `function applyForJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof)` (contracts/AGIJobManager.sol:512)
- `function validateJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof)` (contracts/AGIJobManager.sol:574)
- `function disapproveJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof)` (contracts/AGIJobManager.sol:582)
- `function updateAGITokenAddress(address _newTokenAddress) external onlyOwner whenIdentityConfigurable` (contracts/AGIJobManager.sol:775)
- `function updateEnsRegistry(address _newEnsRegistry) external onlyOwner whenIdentityConfigurable` (contracts/AGIJobManager.sol:782)
- `function updateNameWrapper(address _newNameWrapper) external onlyOwner whenIdentityConfigurable` (contracts/AGIJobManager.sol:788)
- `function setEnsJobPages(address _ensJobPages) external onlyOwner whenIdentityConfigurable` (contracts/AGIJobManager.sol:794)
- `function updateRootNodes(` (contracts/AGIJobManager.sol:803)
- `function updateMerkleRoots(bytes32 _validatorMerkleRoot, bytes32 _agentMerkleRoot)` (contracts/AGIJobManager.sol:816)
- `function lockJobENS(uint256 jobId, bool burnFuses) external` (contracts/AGIJobManager.sol:1041)
- `function tokenURI(uint256 tokenId) public view override returns (string memory)` (contracts/AGIJobManager.sol:1277)
- `function _callEnsJobPagesHook(uint8 hook, uint256 jobId) internal` (contracts/AGIJobManager.sol:1282)
- `function verifyENSOwnership(` (contracts/utils/ENSOwnership.sol:32)
- `function verifyENSOwnership(` (contracts/utils/ENSOwnership.sol:48)
- `function verifyMerkleOwnership(address claimant, bytes32[] calldata proof, bytes32 merkleRoot)` (contracts/utils/ENSOwnership.sol:61)
- `function setENSRegistry(address ensAddress) external onlyOwner` (contracts/ens/ENSJobPages.sol:101)
- `function setNameWrapper(address nameWrapperAddress) external onlyOwner` (contracts/ens/ENSJobPages.sol:109)
- `function setJobsRoot(bytes32 rootNode, string calldata rootName) external onlyOwner` (contracts/ens/ENSJobPages.sol:125)
- `function lockConfiguration() external onlyOwner` (contracts/ens/ENSJobPages.sol:151)
- `function handleHook(uint8 hook, uint256 jobId) external onlyJobManager` (contracts/ens/ENSJobPages.sol:204)
- `function lockJobENS(uint256 jobId, address employer, address agent, bool burnFuses) public onlyOwner` (contracts/ens/ENSJobPages.sol:347)
- `function _lockJobENS(uint256 jobId, address employer, address agent, bool burnFuses) internal` (contracts/ens/ENSJobPages.sol:352)

## Events and errors

- `error NotAuthorized();` (contracts/AGIJobManager.sol:75)
- `error InvalidParameters();` (contracts/AGIJobManager.sol:77)
- `error ConfigLocked();` (contracts/AGIJobManager.sol:86)
- `event EnsRegistryUpdated(address newEnsRegistry);` (contracts/AGIJobManager.sol:219)
- `event RootNodesUpdated(` (contracts/AGIJobManager.sol:221)
- `event MerkleRootsUpdated(bytes32 validatorMerkleRoot, bytes32 agentMerkleRoot);` (contracts/AGIJobManager.sol:227)
- `event IdentityConfigurationLocked(address indexed locker, uint256 indexed atTimestamp);` (contracts/AGIJobManager.sol:234)
- `event EnsJobPagesUpdated(address indexed oldEnsJobPages, address indexed newEnsJobPages);` (contracts/AGIJobManager.sol:241)
- `event EnsHookAttempted(uint8 indexed hook, uint256 indexed jobId, address indexed target, bool success);` (contracts/AGIJobManager.sol:256)
- `error ENSNotConfigured();` (contracts/ens/ENSJobPages.sol:34)
- `error ENSNotAuthorized();` (contracts/ens/ENSJobPages.sol:35)
- `error InvalidParameters();` (contracts/ens/ENSJobPages.sol:36)
- `event JobENSPageCreated(uint256 indexed jobId, bytes32 indexed node);` (contracts/ens/ENSJobPages.sol:52)
- `event JobENSPermissionsUpdated(uint256 indexed jobId, address indexed account, bool isAuthorised);` (contracts/ens/ENSJobPages.sol:53)
- `event JobENSLocked(uint256 indexed jobId, bytes32 indexed node, bool fusesBurned);` (contracts/ens/ENSJobPages.sol:54)
- `event ENSRegistryUpdated(address indexed oldEns, address indexed newEns);` (contracts/ens/ENSJobPages.sol:55)
- `event UseEnsJobTokenURIUpdated(bool oldValue, bool newValue);` (contracts/ens/ENSJobPages.sol:65)
- `event ENSHookProcessed(uint8 indexed hook, uint256 indexed jobId, bool configured, bool success);` (contracts/ens/ENSJobPages.sol:66)
- `event ENSHookSkipped(uint8 indexed hook, uint256 indexed jobId, bytes32 indexed reason);` (contracts/ens/ENSJobPages.sol:67)
- `event ENSHookBestEffortFailure(uint8 indexed hook, uint256 indexed jobId, bytes32 indexed operation);` (contracts/ens/ENSJobPages.sol:68)

## Notes / caveats from code comments

- @notice Total AGI locked as agent performance bonds for unsettled jobs. (contracts/AGIJobManager.sol:128)
- @notice Total AGI locked as validator bonds for unsettled votes. (contracts/AGIJobManager.sol:130)
- @notice Total AGI locked as dispute bonds for unsettled disputes. (contracts/AGIJobManager.sol:132)
- @notice Freezes token/ENS/namewrapper/root nodes. Not a governance lock; ops remain owner-controlled. (contracts/AGIJobManager.sol:146)
- @notice Anyone may lock ENS records after a job reaches a terminal state; only the owner may burn fuses. (contracts/AGIJobManager.sol:1039)
- @dev Fuse burning is irreversible and remains owner-only; ENS hook execution is best-effort. (contracts/AGIJobManager.sol:1040)
- @dev as long as lockedEscrow/locked*Bonds are fully covered. (contracts/AGIJobManager.sol:1087)
- @dev Owner withdrawals are limited to balances not backing lockedEscrow/locked*Bonds. (contracts/AGIJobManager.sol:1312)

