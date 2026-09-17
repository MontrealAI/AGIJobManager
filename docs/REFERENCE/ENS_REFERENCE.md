# ENS Reference (Generated)

Generated at (UTC): 1970-01-01T00:00:00Z
Source fingerprint: d687010a961ca356

Source files used:
- `contracts/AGIJobManager.sol`
- `contracts/utils/ENSOwnership.sol`
- `contracts/ens/ENSJobPages.sol`
- `contracts/ens/IENSJobPages.sol`

## ENS surface area

- `bytes32 public clubRootNode;` ([contracts/AGIJobManager.sol#L350](../../contracts/AGIJobManager.sol#L350))
- `bytes32 public alphaClubRootNode;` ([contracts/AGIJobManager.sol#L351](../../contracts/AGIJobManager.sol#L351))
- `bytes32 public agentRootNode;` ([contracts/AGIJobManager.sol#L352](../../contracts/AGIJobManager.sol#L352))
- `bytes32 public alphaAgentRootNode;` ([contracts/AGIJobManager.sol#L353](../../contracts/AGIJobManager.sol#L353))
- `bytes32 public validatorMerkleRoot;` ([contracts/AGIJobManager.sol#L354](../../contracts/AGIJobManager.sol#L354))
- `bytes32 public agentMerkleRoot;` ([contracts/AGIJobManager.sol#L355](../../contracts/AGIJobManager.sol#L355))
- `ENS public ens;` ([contracts/AGIJobManager.sol#L356](../../contracts/AGIJobManager.sol#L356))
- `NameWrapper public nameWrapper;` ([contracts/AGIJobManager.sol#L357](../../contracts/AGIJobManager.sol#L357))
- `address public ensJobPages;` ([contracts/AGIJobManager.sol#L358](../../contracts/AGIJobManager.sol#L358))
- `bool public lockIdentityConfig;` ([contracts/AGIJobManager.sol#L361](../../contracts/AGIJobManager.sol#L361))
- `IENSRegistry public ens;` ([contracts/ens/ENSJobPages.sol#L109](../../contracts/ens/ENSJobPages.sol#L109))
- `INameWrapper public nameWrapper;` ([contracts/ens/ENSJobPages.sol#L110](../../contracts/ens/ENSJobPages.sol#L110))
- `IPublicResolver public publicResolver;` ([contracts/ens/ENSJobPages.sol#L111](../../contracts/ens/ENSJobPages.sol#L111))
- `bytes32 public jobsRootNode;` ([contracts/ens/ENSJobPages.sol#L112](../../contracts/ens/ENSJobPages.sol#L112))
- `string public jobsRootName;` ([contracts/ens/ENSJobPages.sol#L113](../../contracts/ens/ENSJobPages.sol#L113))
- `address public jobManager;` ([contracts/ens/ENSJobPages.sol#L114](../../contracts/ens/ENSJobPages.sol#L114))
- `bool public useEnsJobTokenURI;` ([contracts/ens/ENSJobPages.sol#L115](../../contracts/ens/ENSJobPages.sol#L115))
- `bool public configLocked;` ([contracts/ens/ENSJobPages.sol#L116](../../contracts/ens/ENSJobPages.sol#L116))
- `string public jobLabelPrefix;` ([contracts/ens/ENSJobPages.sol#L118](../../contracts/ens/ENSJobPages.sol#L118))

## Config and locks

- `function _initRoots(bytes32[4] memory rootNodes, bytes32[2] memory merkleRoots) internal` ([contracts/AGIJobManager.sol#L542](../../contracts/AGIJobManager.sol#L542))
- `function lockIdentityConfiguration() external onlyOwner whenIdentityConfigurable` ([contracts/AGIJobManager.sol#L700](../../contracts/AGIJobManager.sol#L700))
- `function applyForJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof)` ([contracts/AGIJobManager.sol#L732](../../contracts/AGIJobManager.sol#L732))
- `function validateJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof)` ([contracts/AGIJobManager.sol#L794](../../contracts/AGIJobManager.sol#L794))
- `function disapproveJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof)` ([contracts/AGIJobManager.sol#L802](../../contracts/AGIJobManager.sol#L802))
- `function updateEnsRegistry(address _newEnsRegistry) external onlyOwner whenIdentityConfigurable` ([contracts/AGIJobManager.sol#L995](../../contracts/AGIJobManager.sol#L995))
- `function updateNameWrapper(address _newNameWrapper) external onlyOwner whenIdentityConfigurable` ([contracts/AGIJobManager.sol#L1001](../../contracts/AGIJobManager.sol#L1001))
- `function setEnsJobPages(address _ensJobPages) external onlyOwner whenIdentityConfigurable` ([contracts/AGIJobManager.sol#L1007](../../contracts/AGIJobManager.sol#L1007))
- `function updateRootNodes(` ([contracts/AGIJobManager.sol#L1016](../../contracts/AGIJobManager.sol#L1016))
- `function updateMerkleRoots(bytes32 _validatorMerkleRoot, bytes32 _agentMerkleRoot)` ([contracts/AGIJobManager.sol#L1029](../../contracts/AGIJobManager.sol#L1029))
- `function lockJobENS(uint256 jobId, bool burnFuses) external` ([contracts/AGIJobManager.sol#L1248](../../contracts/AGIJobManager.sol#L1248))
- `function tokenURI(uint256 tokenId) public view override returns (string memory)` ([contracts/AGIJobManager.sol#L1484](../../contracts/AGIJobManager.sol#L1484))
- `function _callEnsJobPagesHook(uint8 hook, uint256 jobId) internal` ([contracts/AGIJobManager.sol#L1489](../../contracts/AGIJobManager.sol#L1489))
- `function setENSRegistry(address ensAddress) external onlyOwner` ([contracts/ens/ENSJobPages.sol#L160](../../contracts/ens/ENSJobPages.sol#L160))
- `function setNameWrapper(address nameWrapperAddress) external onlyOwner` ([contracts/ens/ENSJobPages.sol#L168](../../contracts/ens/ENSJobPages.sol#L168))
- `function setJobsRoot(bytes32 rootNode, string calldata rootName) external onlyOwner` ([contracts/ens/ENSJobPages.sol#L184](../../contracts/ens/ENSJobPages.sol#L184))
- `function lockConfiguration() external onlyOwner` ([contracts/ens/ENSJobPages.sol#L210](../../contracts/ens/ENSJobPages.sol#L210))
- `function handleHook(uint8 hook, uint256 jobId) external onlyJobManager` ([contracts/ens/ENSJobPages.sol#L355](../../contracts/ens/ENSJobPages.sol#L355))
- `function lockJobENS(uint256 jobId, address employer, address agent, bool burnFuses) public onlyOwner` ([contracts/ens/ENSJobPages.sol#L505](../../contracts/ens/ENSJobPages.sol#L505))
- `function _lockJobENS(uint256 jobId, address employer, address agent, bool burnFuses) internal` ([contracts/ens/ENSJobPages.sol#L510](../../contracts/ens/ENSJobPages.sol#L510))
- `function verifyENSOwnership(` ([contracts/utils/ENSOwnership.sol#L32](../../contracts/utils/ENSOwnership.sol#L32))
- `function verifyENSOwnership(` ([contracts/utils/ENSOwnership.sol#L48](../../contracts/utils/ENSOwnership.sol#L48))
- `function verifyMerkleOwnership(address claimant, bytes32[] calldata proof, bytes32 merkleRoot)` ([contracts/utils/ENSOwnership.sol#L61](../../contracts/utils/ENSOwnership.sol#L61))

## Events and errors

- `error NotAuthorized();` ([contracts/AGIJobManager.sol#L289](../../contracts/AGIJobManager.sol#L289))
- `error InvalidParameters();` ([contracts/AGIJobManager.sol#L291](../../contracts/AGIJobManager.sol#L291))
- `error ConfigLocked();` ([contracts/AGIJobManager.sol#L300](../../contracts/AGIJobManager.sol#L300))
- `event EnsRegistryUpdated(address newEnsRegistry);` ([contracts/AGIJobManager.sol#L433](../../contracts/AGIJobManager.sol#L433))
- `event RootNodesUpdated(` ([contracts/AGIJobManager.sol#L435](../../contracts/AGIJobManager.sol#L435))
- `event MerkleRootsUpdated(bytes32 validatorMerkleRoot, bytes32 agentMerkleRoot);` ([contracts/AGIJobManager.sol#L441](../../contracts/AGIJobManager.sol#L441))
- `event IdentityConfigurationLocked(address indexed locker, uint256 indexed atTimestamp);` ([contracts/AGIJobManager.sol#L448](../../contracts/AGIJobManager.sol#L448))
- `event EnsJobPagesUpdated(address indexed oldEnsJobPages, address indexed newEnsJobPages);` ([contracts/AGIJobManager.sol#L454](../../contracts/AGIJobManager.sol#L454))
- `event EnsHookAttempted(uint8 indexed hook, uint256 indexed jobId, address indexed target, bool success);` ([contracts/AGIJobManager.sol#L469](../../contracts/AGIJobManager.sol#L469))
- `error ENSNotConfigured();` ([contracts/ens/ENSJobPages.sol#L49](../../contracts/ens/ENSJobPages.sol#L49))
- `error ENSNotAuthorized();` ([contracts/ens/ENSJobPages.sol#L50](../../contracts/ens/ENSJobPages.sol#L50))
- `error InvalidParameters();` ([contracts/ens/ENSJobPages.sol#L51](../../contracts/ens/ENSJobPages.sol#L51))
- `event JobENSPageCreated(uint256 indexed jobId, bytes32 indexed node);` ([contracts/ens/ENSJobPages.sol#L82](../../contracts/ens/ENSJobPages.sol#L82))
- `event JobENSPermissionsUpdated(uint256 indexed jobId, address indexed account, bool isAuthorised);` ([contracts/ens/ENSJobPages.sol#L83](../../contracts/ens/ENSJobPages.sol#L83))
- `event JobENSLocked(uint256 indexed jobId, bytes32 indexed node, bool fusesBurned);` ([contracts/ens/ENSJobPages.sol#L84](../../contracts/ens/ENSJobPages.sol#L84))
- `event ENSRegistryUpdated(address indexed oldEns, address indexed newEns);` ([contracts/ens/ENSJobPages.sol#L85](../../contracts/ens/ENSJobPages.sol#L85))
- `event UseEnsJobTokenURIUpdated(bool oldValue, bool newValue);` ([contracts/ens/ENSJobPages.sol#L95](../../contracts/ens/ENSJobPages.sol#L95))
- `event ENSHookProcessed(uint8 indexed hook, uint256 indexed jobId, bool configured, bool success);` ([contracts/ens/ENSJobPages.sol#L96](../../contracts/ens/ENSJobPages.sol#L96))
- `event ENSHookSkipped(uint8 indexed hook, uint256 indexed jobId, bytes32 indexed reason);` ([contracts/ens/ENSJobPages.sol#L97](../../contracts/ens/ENSJobPages.sol#L97))
- `event ENSHookBestEffortFailure(uint8 indexed hook, uint256 indexed jobId, bytes32 indexed operation);` ([contracts/ens/ENSJobPages.sol#L98](../../contracts/ens/ENSJobPages.sol#L98))

## Notes / caveats from code comments

- @notice Total USDC locked as agent performance bonds for unsettled jobs. ([contracts/AGIJobManager.sol#L342](../../contracts/AGIJobManager.sol#L342))
- @notice Total USDC locked as validator bonds for unsettled votes. ([contracts/AGIJobManager.sol#L344](../../contracts/AGIJobManager.sol#L344))
- @notice Total USDC locked as dispute bonds for unsettled disputes. ([contracts/AGIJobManager.sol#L346](../../contracts/AGIJobManager.sol#L346))
- @notice Freezes ENS/namewrapper/root nodes; USDC is immutable at deployment. Not a governance lock; ops remain owner-controlled. ([contracts/AGIJobManager.sol#L360](../../contracts/AGIJobManager.sol#L360))
- @notice Anyone may lock ENS records after a job reaches a terminal state; only the owner may burn fuses. ([contracts/AGIJobManager.sol#L1246](../../contracts/AGIJobManager.sol#L1246))
- @dev Fuse burning is irreversible and remains owner-only; ENS hook execution is best-effort. ([contracts/AGIJobManager.sol#L1247](../../contracts/AGIJobManager.sol#L1247))
- @dev as long as lockedEscrow/locked*Bonds are fully covered. ([contracts/AGIJobManager.sol#L1294](../../contracts/AGIJobManager.sol#L1294))
- @dev Owner withdrawals are limited to balances not backing lockedEscrow/locked*Bonds. ([contracts/AGIJobManager.sol#L1519](../../contracts/AGIJobManager.sol#L1519))
- @notice Prefix used when constructing ENS job labels as prefix + decimal(jobId). ([contracts/ens/ENSJobPages.sol#L117](../../contracts/ens/ENSJobPages.sol#L117))
- @notice Updates the default prefix used for unsnapshotted/future job ENS labels. ([contracts/ens/ENSJobPages.sol#L148](../../contracts/ens/ENSJobPages.sol#L148))
-      Legacy jobs that predate this contract must be migrated before hooks can mutate ENS records. ([contracts/ens/ENSJobPages.sol#L809](../../contracts/ens/ENSJobPages.sol#L809))

