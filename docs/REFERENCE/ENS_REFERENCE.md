# ENS Reference (Generated)

Generated at (UTC): 1970-01-01T00:00:00Z
Source fingerprint: 72c3b81ccb3ea16c

Source files used:
- `contracts/AGIJobManager.sol`
- `contracts/utils/ENSOwnership.sol`
- `contracts/ens/ENSJobPages.sol`
- `contracts/ens/IENSJobPages.sol`

## ENS surface area

- `bytes32 public clubRootNode;` ([contracts/AGIJobManager.sol#L136](../../contracts/AGIJobManager.sol#L136))
- `bytes32 public alphaClubRootNode;` ([contracts/AGIJobManager.sol#L137](../../contracts/AGIJobManager.sol#L137))
- `bytes32 public agentRootNode;` ([contracts/AGIJobManager.sol#L138](../../contracts/AGIJobManager.sol#L138))
- `bytes32 public alphaAgentRootNode;` ([contracts/AGIJobManager.sol#L139](../../contracts/AGIJobManager.sol#L139))
- `bytes32 public validatorMerkleRoot;` ([contracts/AGIJobManager.sol#L140](../../contracts/AGIJobManager.sol#L140))
- `bytes32 public agentMerkleRoot;` ([contracts/AGIJobManager.sol#L141](../../contracts/AGIJobManager.sol#L141))
- `ENS public ens;` ([contracts/AGIJobManager.sol#L142](../../contracts/AGIJobManager.sol#L142))
- `NameWrapper public nameWrapper;` ([contracts/AGIJobManager.sol#L143](../../contracts/AGIJobManager.sol#L143))
- `address public ensJobPages;` ([contracts/AGIJobManager.sol#L144](../../contracts/AGIJobManager.sol#L144))
- `bool public lockIdentityConfig;` ([contracts/AGIJobManager.sol#L147](../../contracts/AGIJobManager.sol#L147))
- `IENSRegistry public ens;` ([contracts/ens/ENSJobPages.sol#L71](../../contracts/ens/ENSJobPages.sol#L71))
- `INameWrapper public nameWrapper;` ([contracts/ens/ENSJobPages.sol#L72](../../contracts/ens/ENSJobPages.sol#L72))
- `IPublicResolver public publicResolver;` ([contracts/ens/ENSJobPages.sol#L73](../../contracts/ens/ENSJobPages.sol#L73))
- `bytes32 public jobsRootNode;` ([contracts/ens/ENSJobPages.sol#L74](../../contracts/ens/ENSJobPages.sol#L74))
- `string public jobsRootName;` ([contracts/ens/ENSJobPages.sol#L75](../../contracts/ens/ENSJobPages.sol#L75))
- `address public jobManager;` ([contracts/ens/ENSJobPages.sol#L76](../../contracts/ens/ENSJobPages.sol#L76))
- `bool public useEnsJobTokenURI;` ([contracts/ens/ENSJobPages.sol#L77](../../contracts/ens/ENSJobPages.sol#L77))
- `bool public configLocked;` ([contracts/ens/ENSJobPages.sol#L78](../../contracts/ens/ENSJobPages.sol#L78))

## Config and locks

- `function _initRoots(bytes32[4] memory rootNodes, bytes32[2] memory merkleRoots) internal` ([contracts/AGIJobManager.sol#L322](../../contracts/AGIJobManager.sol#L322))
- `function lockIdentityConfiguration() external onlyOwner whenIdentityConfigurable` ([contracts/AGIJobManager.sol#L480](../../contracts/AGIJobManager.sol#L480))
- `function applyForJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof)` ([contracts/AGIJobManager.sol#L512](../../contracts/AGIJobManager.sol#L512))
- `function validateJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof)` ([contracts/AGIJobManager.sol#L574](../../contracts/AGIJobManager.sol#L574))
- `function disapproveJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof)` ([contracts/AGIJobManager.sol#L582](../../contracts/AGIJobManager.sol#L582))
- `function updateAGITokenAddress(address _newTokenAddress) external onlyOwner whenIdentityConfigurable` ([contracts/AGIJobManager.sol#L775](../../contracts/AGIJobManager.sol#L775))
- `function updateEnsRegistry(address _newEnsRegistry) external onlyOwner whenIdentityConfigurable` ([contracts/AGIJobManager.sol#L782](../../contracts/AGIJobManager.sol#L782))
- `function updateNameWrapper(address _newNameWrapper) external onlyOwner whenIdentityConfigurable` ([contracts/AGIJobManager.sol#L788](../../contracts/AGIJobManager.sol#L788))
- `function setEnsJobPages(address _ensJobPages) external onlyOwner whenIdentityConfigurable` ([contracts/AGIJobManager.sol#L794](../../contracts/AGIJobManager.sol#L794))
- `function updateRootNodes(` ([contracts/AGIJobManager.sol#L803](../../contracts/AGIJobManager.sol#L803))
- `function updateMerkleRoots(bytes32 _validatorMerkleRoot, bytes32 _agentMerkleRoot)` ([contracts/AGIJobManager.sol#L816](../../contracts/AGIJobManager.sol#L816))
- `function lockJobENS(uint256 jobId, bool burnFuses) external` ([contracts/AGIJobManager.sol#L1041](../../contracts/AGIJobManager.sol#L1041))
- `function tokenURI(uint256 tokenId) public view override returns (string memory)` ([contracts/AGIJobManager.sol#L1277](../../contracts/AGIJobManager.sol#L1277))
- `function _callEnsJobPagesHook(uint8 hook, uint256 jobId) internal` ([contracts/AGIJobManager.sol#L1282](../../contracts/AGIJobManager.sol#L1282))
- `function setENSRegistry(address ensAddress) external onlyOwner` ([contracts/ens/ENSJobPages.sol#L101](../../contracts/ens/ENSJobPages.sol#L101))
- `function setNameWrapper(address nameWrapperAddress) external onlyOwner` ([contracts/ens/ENSJobPages.sol#L109](../../contracts/ens/ENSJobPages.sol#L109))
- `function setJobsRoot(bytes32 rootNode, string calldata rootName) external onlyOwner` ([contracts/ens/ENSJobPages.sol#L125](../../contracts/ens/ENSJobPages.sol#L125))
- `function lockConfiguration() external onlyOwner` ([contracts/ens/ENSJobPages.sol#L151](../../contracts/ens/ENSJobPages.sol#L151))
- `function handleHook(uint8 hook, uint256 jobId) external onlyJobManager` ([contracts/ens/ENSJobPages.sol#L204](../../contracts/ens/ENSJobPages.sol#L204))
- `function lockJobENS(uint256 jobId, address employer, address agent, bool burnFuses) public onlyOwner` ([contracts/ens/ENSJobPages.sol#L347](../../contracts/ens/ENSJobPages.sol#L347))
- `function _lockJobENS(uint256 jobId, address employer, address agent, bool burnFuses) internal` ([contracts/ens/ENSJobPages.sol#L352](../../contracts/ens/ENSJobPages.sol#L352))
- `function verifyENSOwnership(` ([contracts/utils/ENSOwnership.sol#L32](../../contracts/utils/ENSOwnership.sol#L32))
- `function verifyENSOwnership(` ([contracts/utils/ENSOwnership.sol#L48](../../contracts/utils/ENSOwnership.sol#L48))
- `function verifyMerkleOwnership(address claimant, bytes32[] calldata proof, bytes32 merkleRoot)` ([contracts/utils/ENSOwnership.sol#L61](../../contracts/utils/ENSOwnership.sol#L61))

## Events and errors

- `error NotAuthorized();` ([contracts/AGIJobManager.sol#L75](../../contracts/AGIJobManager.sol#L75))
- `error InvalidParameters();` ([contracts/AGIJobManager.sol#L77](../../contracts/AGIJobManager.sol#L77))
- `error ConfigLocked();` ([contracts/AGIJobManager.sol#L86](../../contracts/AGIJobManager.sol#L86))
- `event EnsRegistryUpdated(address newEnsRegistry);` ([contracts/AGIJobManager.sol#L219](../../contracts/AGIJobManager.sol#L219))
- `event RootNodesUpdated(` ([contracts/AGIJobManager.sol#L221](../../contracts/AGIJobManager.sol#L221))
- `event MerkleRootsUpdated(bytes32 validatorMerkleRoot, bytes32 agentMerkleRoot);` ([contracts/AGIJobManager.sol#L227](../../contracts/AGIJobManager.sol#L227))
- `event IdentityConfigurationLocked(address indexed locker, uint256 indexed atTimestamp);` ([contracts/AGIJobManager.sol#L234](../../contracts/AGIJobManager.sol#L234))
- `event EnsJobPagesUpdated(address indexed oldEnsJobPages, address indexed newEnsJobPages);` ([contracts/AGIJobManager.sol#L241](../../contracts/AGIJobManager.sol#L241))
- `event EnsHookAttempted(uint8 indexed hook, uint256 indexed jobId, address indexed target, bool success);` ([contracts/AGIJobManager.sol#L256](../../contracts/AGIJobManager.sol#L256))
- `error ENSNotConfigured();` ([contracts/ens/ENSJobPages.sol#L34](../../contracts/ens/ENSJobPages.sol#L34))
- `error ENSNotAuthorized();` ([contracts/ens/ENSJobPages.sol#L35](../../contracts/ens/ENSJobPages.sol#L35))
- `error InvalidParameters();` ([contracts/ens/ENSJobPages.sol#L36](../../contracts/ens/ENSJobPages.sol#L36))
- `event JobENSPageCreated(uint256 indexed jobId, bytes32 indexed node);` ([contracts/ens/ENSJobPages.sol#L52](../../contracts/ens/ENSJobPages.sol#L52))
- `event JobENSPermissionsUpdated(uint256 indexed jobId, address indexed account, bool isAuthorised);` ([contracts/ens/ENSJobPages.sol#L53](../../contracts/ens/ENSJobPages.sol#L53))
- `event JobENSLocked(uint256 indexed jobId, bytes32 indexed node, bool fusesBurned);` ([contracts/ens/ENSJobPages.sol#L54](../../contracts/ens/ENSJobPages.sol#L54))
- `event ENSRegistryUpdated(address indexed oldEns, address indexed newEns);` ([contracts/ens/ENSJobPages.sol#L55](../../contracts/ens/ENSJobPages.sol#L55))
- `event UseEnsJobTokenURIUpdated(bool oldValue, bool newValue);` ([contracts/ens/ENSJobPages.sol#L65](../../contracts/ens/ENSJobPages.sol#L65))
- `event ENSHookProcessed(uint8 indexed hook, uint256 indexed jobId, bool configured, bool success);` ([contracts/ens/ENSJobPages.sol#L66](../../contracts/ens/ENSJobPages.sol#L66))
- `event ENSHookSkipped(uint8 indexed hook, uint256 indexed jobId, bytes32 indexed reason);` ([contracts/ens/ENSJobPages.sol#L67](../../contracts/ens/ENSJobPages.sol#L67))
- `event ENSHookBestEffortFailure(uint8 indexed hook, uint256 indexed jobId, bytes32 indexed operation);` ([contracts/ens/ENSJobPages.sol#L68](../../contracts/ens/ENSJobPages.sol#L68))

## Notes / caveats from code comments

- @notice Total AGI locked as agent performance bonds for unsettled jobs. ([contracts/AGIJobManager.sol#L128](../../contracts/AGIJobManager.sol#L128))
- @notice Total AGI locked as validator bonds for unsettled votes. ([contracts/AGIJobManager.sol#L130](../../contracts/AGIJobManager.sol#L130))
- @notice Total AGI locked as dispute bonds for unsettled disputes. ([contracts/AGIJobManager.sol#L132](../../contracts/AGIJobManager.sol#L132))
- @notice Freezes token/ENS/namewrapper/root nodes. Not a governance lock; ops remain owner-controlled. ([contracts/AGIJobManager.sol#L146](../../contracts/AGIJobManager.sol#L146))
- @notice Anyone may lock ENS records after a job reaches a terminal state; only the owner may burn fuses. ([contracts/AGIJobManager.sol#L1039](../../contracts/AGIJobManager.sol#L1039))
- @dev Fuse burning is irreversible and remains owner-only; ENS hook execution is best-effort. ([contracts/AGIJobManager.sol#L1040](../../contracts/AGIJobManager.sol#L1040))
- @dev as long as lockedEscrow/locked*Bonds are fully covered. ([contracts/AGIJobManager.sol#L1087](../../contracts/AGIJobManager.sol#L1087))
- @dev Owner withdrawals are limited to balances not backing lockedEscrow/locked*Bonds. ([contracts/AGIJobManager.sol#L1312](../../contracts/AGIJobManager.sol#L1312))

