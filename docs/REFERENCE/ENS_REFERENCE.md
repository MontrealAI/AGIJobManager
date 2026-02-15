# ENS Reference (Generated)

Source fingerprint: 19ae15d1e202bb4b

Source files used:
- `contracts/AGIJobManager.sol`
- `contracts/utils/ENSOwnership.sol`
- `contracts/ens/ENSJobPages.sol`
- `contracts/ens/IENSJobPages.sol`

## ENS surface area

- `bytes32 public clubRootNode;` (contracts/AGIJobManager.sol:134)
- `bytes32 public alphaClubRootNode;` (contracts/AGIJobManager.sol:135)
- `bytes32 public agentRootNode;` (contracts/AGIJobManager.sol:136)
- `bytes32 public alphaAgentRootNode;` (contracts/AGIJobManager.sol:137)
- `bytes32 public validatorMerkleRoot;` (contracts/AGIJobManager.sol:138)
- `bytes32 public agentMerkleRoot;` (contracts/AGIJobManager.sol:139)
- `ENS public ens;` (contracts/AGIJobManager.sol:140)
- `NameWrapper public nameWrapper;` (contracts/AGIJobManager.sol:141)
- `address public ensJobPages;` (contracts/AGIJobManager.sol:142)
- `bool public lockIdentityConfig;` (contracts/AGIJobManager.sol:145)
- `IENSRegistry public ens;` (contracts/ens/ENSJobPages.sol:65)
- `INameWrapper public nameWrapper;` (contracts/ens/ENSJobPages.sol:66)
- `IPublicResolver public publicResolver;` (contracts/ens/ENSJobPages.sol:67)
- `bytes32 public jobsRootNode;` (contracts/ens/ENSJobPages.sol:68)
- `string public jobsRootName;` (contracts/ens/ENSJobPages.sol:69)
- `address public jobManager;` (contracts/ens/ENSJobPages.sol:70)
- `bool public useEnsJobTokenURI;` (contracts/ens/ENSJobPages.sol:71)
- `bool public configLocked;` (contracts/ens/ENSJobPages.sol:72)

## Config and locks

- `function _initRoots(bytes32[4] memory rootNodes, bytes32[2] memory merkleRoots) internal` (contracts/AGIJobManager.sol:319)
- `function lockIdentityConfiguration() external onlyOwner whenIdentityConfigurable` (contracts/AGIJobManager.sol:461)
- `function applyForJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof)` (contracts/AGIJobManager.sol:492)
- `function validateJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof)` (contracts/AGIJobManager.sol:554)
- `function disapproveJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof)` (contracts/AGIJobManager.sol:562)
- `function updateAGITokenAddress(address _newTokenAddress) external onlyOwner whenIdentityConfigurable` (contracts/AGIJobManager.sol:755)
- `function updateEnsRegistry(address _newEnsRegistry) external onlyOwner whenIdentityConfigurable` (contracts/AGIJobManager.sol:762)
- `function updateNameWrapper(address _newNameWrapper) external onlyOwner whenIdentityConfigurable` (contracts/AGIJobManager.sol:768)
- `function setEnsJobPages(address _ensJobPages) external onlyOwner whenIdentityConfigurable` (contracts/AGIJobManager.sol:774)
- `function updateRootNodes(` (contracts/AGIJobManager.sol:783)
- `function updateMerkleRoots(bytes32 _validatorMerkleRoot, bytes32 _agentMerkleRoot) external onlyOwner` (contracts/AGIJobManager.sol:796)
- `function lockJobENS(uint256 jobId, bool burnFuses) external` (contracts/AGIJobManager.sol:1007)
- `function tokenURI(uint256 tokenId) public view override returns (string memory)` (contracts/AGIJobManager.sol:1243)
- `function _callEnsJobPagesHook(uint8 hook, uint256 jobId) internal` (contracts/AGIJobManager.sol:1248)
- `function verifyENSOwnership(` (contracts/utils/ENSOwnership.sol:32)
- `function verifyENSOwnership(` (contracts/utils/ENSOwnership.sol:48)
- `function verifyMerkleOwnership(address claimant, bytes32[] calldata proof, bytes32 merkleRoot)` (contracts/utils/ENSOwnership.sol:61)
- `function setENSRegistry(address ensAddress) external onlyOwner` (contracts/ens/ENSJobPages.sol:95)
- `function setNameWrapper(address nameWrapperAddress) external onlyOwner` (contracts/ens/ENSJobPages.sol:103)
- `function setJobsRoot(bytes32 rootNode, string calldata rootName) external onlyOwner` (contracts/ens/ENSJobPages.sol:119)
- `function lockConfiguration() external onlyOwner` (contracts/ens/ENSJobPages.sol:144)
- `function handleHook(uint8 hook, uint256 jobId) external onlyJobManager` (contracts/ens/ENSJobPages.sol:197)
- `function lockJobENS(uint256 jobId, address employer, address agent, bool burnFuses) public onlyOwner` (contracts/ens/ENSJobPages.sol:340)
- `function _lockJobENS(uint256 jobId, address employer, address agent, bool burnFuses) internal` (contracts/ens/ENSJobPages.sol:345)

## Events and errors

- `error NotAuthorized();` (contracts/AGIJobManager.sol:73)
- `error InvalidParameters();` (contracts/AGIJobManager.sol:75)
- `error ConfigLocked();` (contracts/AGIJobManager.sol:84)
- `event EnsRegistryUpdated(address newEnsRegistry);` (contracts/AGIJobManager.sol:217)
- `event RootNodesUpdated(` (contracts/AGIJobManager.sol:219)
- `event MerkleRootsUpdated(bytes32 validatorMerkleRoot, bytes32 agentMerkleRoot);` (contracts/AGIJobManager.sol:225)
- `event IdentityConfigurationLocked(address indexed locker, uint256 indexed atTimestamp);` (contracts/AGIJobManager.sol:232)
- `event EnsJobPagesUpdated(address indexed oldEnsJobPages, address indexed newEnsJobPages);` (contracts/AGIJobManager.sol:239)
- `event EnsHookAttempted(uint8 indexed hook, uint256 indexed jobId, address indexed target, bool success);` (contracts/AGIJobManager.sol:254)
- `error ENSNotConfigured();` (contracts/ens/ENSJobPages.sol:34)
- `error ENSNotAuthorized();` (contracts/ens/ENSJobPages.sol:35)
- `error InvalidParameters();` (contracts/ens/ENSJobPages.sol:36)
- `event JobENSPageCreated(uint256 indexed jobId, bytes32 indexed node);` (contracts/ens/ENSJobPages.sol:46)
- `event JobENSPermissionsUpdated(uint256 indexed jobId, address indexed account, bool isAuthorised);` (contracts/ens/ENSJobPages.sol:47)
- `event JobENSLocked(uint256 indexed jobId, bytes32 indexed node, bool fusesBurned);` (contracts/ens/ENSJobPages.sol:48)
- `event ENSRegistryUpdated(address indexed oldEns, address indexed newEns);` (contracts/ens/ENSJobPages.sol:49)
- `event UseEnsJobTokenURIUpdated(bool oldValue, bool newValue);` (contracts/ens/ENSJobPages.sol:59)
- `event ENSHookProcessed(uint8 indexed hook, uint256 indexed jobId, bool configured, bool success);` (contracts/ens/ENSJobPages.sol:60)
- `event ENSHookSkipped(uint8 indexed hook, uint256 indexed jobId, bytes32 indexed reason);` (contracts/ens/ENSJobPages.sol:61)
- `event ENSHookBestEffortFailure(uint8 indexed hook, uint256 indexed jobId, bytes32 indexed operation);` (contracts/ens/ENSJobPages.sol:62)

## Notes / caveats from code comments

- @notice Total AGI locked as agent performance bonds for unsettled jobs. (contracts/AGIJobManager.sol:126)
- @notice Total AGI locked as validator bonds for unsettled votes. (contracts/AGIJobManager.sol:128)
- @notice Total AGI locked as dispute bonds for unsettled disputes. (contracts/AGIJobManager.sol:130)
- @notice Freezes token/ENS/namewrapper/root nodes. Not a governance lock; ops remain owner-controlled. (contracts/AGIJobManager.sol:144)
- @notice Anyone may lock ENS records after a job reaches a terminal state; only the owner may burn fuses. (contracts/AGIJobManager.sol:1005)
- @dev Fuse burning is irreversible and remains owner-only; ENS hook execution is best-effort. (contracts/AGIJobManager.sol:1006)
- @dev as long as lockedEscrow/locked*Bonds are fully covered. (contracts/AGIJobManager.sol:1053)
- @dev Owner withdrawals are limited to balances not backing lockedEscrow/locked*Bonds. (contracts/AGIJobManager.sol:1277)

