# ENS Reference (Generated)

Generated at (UTC): 1970-01-01T00:00:00Z
Source fingerprint: 40ab3302dac2a39a

Source files used:
- `contracts/AGIJobManager.sol`
- `contracts/utils/ENSOwnership.sol`
- `contracts/ens/ENSJobPages.sol`
- `contracts/ens/IENSJobPages.sol`

## ENS surface area

- `bytes32 public clubRootNode;` ([contracts/AGIJobManager.sol#L352](../../contracts/AGIJobManager.sol#L352))
- `bytes32 public alphaClubRootNode;` ([contracts/AGIJobManager.sol#L353](../../contracts/AGIJobManager.sol#L353))
- `bytes32 public agentRootNode;` ([contracts/AGIJobManager.sol#L354](../../contracts/AGIJobManager.sol#L354))
- `bytes32 public alphaAgentRootNode;` ([contracts/AGIJobManager.sol#L355](../../contracts/AGIJobManager.sol#L355))
- `bytes32 public validatorMerkleRoot;` ([contracts/AGIJobManager.sol#L356](../../contracts/AGIJobManager.sol#L356))
- `bytes32 public agentMerkleRoot;` ([contracts/AGIJobManager.sol#L357](../../contracts/AGIJobManager.sol#L357))
- `ENS public ens;` ([contracts/AGIJobManager.sol#L358](../../contracts/AGIJobManager.sol#L358))
- `NameWrapper public nameWrapper;` ([contracts/AGIJobManager.sol#L359](../../contracts/AGIJobManager.sol#L359))
- `address public ensJobPages;` ([contracts/AGIJobManager.sol#L360](../../contracts/AGIJobManager.sol#L360))
- `bool public lockIdentityConfig;` ([contracts/AGIJobManager.sol#L363](../../contracts/AGIJobManager.sol#L363))
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

- `function _initRoots(bytes32[4] memory rootNodes, bytes32[2] memory merkleRoots) internal` ([contracts/AGIJobManager.sol#L548](../../contracts/AGIJobManager.sol#L548))
- `function lockIdentityConfiguration() external onlyOwner whenIdentityConfigurable` ([contracts/AGIJobManager.sol#L718](../../contracts/AGIJobManager.sol#L718))
- `function applyForJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof)` ([contracts/AGIJobManager.sol#L754](../../contracts/AGIJobManager.sol#L754))
- `function validateJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof)` ([contracts/AGIJobManager.sol#L815](../../contracts/AGIJobManager.sol#L815))
- `function disapproveJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof)` ([contracts/AGIJobManager.sol#L823](../../contracts/AGIJobManager.sol#L823))
- `function updateEnsRegistry(address _newEnsRegistry) external onlyOwner whenIdentityConfigurable` ([contracts/AGIJobManager.sol#L1022](../../contracts/AGIJobManager.sol#L1022))
- `function updateNameWrapper(address _newNameWrapper) external onlyOwner whenIdentityConfigurable` ([contracts/AGIJobManager.sol#L1028](../../contracts/AGIJobManager.sol#L1028))
- `function setEnsJobPages(address _ensJobPages) external onlyOwner whenIdentityConfigurable` ([contracts/AGIJobManager.sol#L1034](../../contracts/AGIJobManager.sol#L1034))
- `function updateRootNodes(` ([contracts/AGIJobManager.sol#L1043](../../contracts/AGIJobManager.sol#L1043))
- `function updateMerkleRoots(bytes32 _validatorMerkleRoot, bytes32 _agentMerkleRoot)` ([contracts/AGIJobManager.sol#L1056](../../contracts/AGIJobManager.sol#L1056))
- `function lockJobENS(uint256 jobId, bool burnFuses) external` ([contracts/AGIJobManager.sol#L1279](../../contracts/AGIJobManager.sol#L1279))
- `function tokenURI(uint256 tokenId) public view override returns (string memory)` ([contracts/AGIJobManager.sol#L1473](../../contracts/AGIJobManager.sol#L1473))
- `function _callEnsJobPagesHook(uint8 hook, uint256 jobId) internal` ([contracts/AGIJobManager.sol#L1478](../../contracts/AGIJobManager.sol#L1478))
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
- `event EnsRegistryUpdated(address newEnsRegistry);` ([contracts/AGIJobManager.sol#L435](../../contracts/AGIJobManager.sol#L435))
- `event RootNodesUpdated(` ([contracts/AGIJobManager.sol#L437](../../contracts/AGIJobManager.sol#L437))
- `event MerkleRootsUpdated(bytes32 validatorMerkleRoot, bytes32 agentMerkleRoot);` ([contracts/AGIJobManager.sol#L443](../../contracts/AGIJobManager.sol#L443))
- `event IdentityConfigurationLocked(address indexed locker, uint256 indexed atTimestamp);` ([contracts/AGIJobManager.sol#L453](../../contracts/AGIJobManager.sol#L453))
- `event EnsJobPagesUpdated(address indexed oldEnsJobPages, address indexed newEnsJobPages);` ([contracts/AGIJobManager.sol#L459](../../contracts/AGIJobManager.sol#L459))
- `event EnsHookAttempted(uint8 indexed hook, uint256 indexed jobId, address indexed target, bool success);` ([contracts/AGIJobManager.sol#L474](../../contracts/AGIJobManager.sol#L474))
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

- @notice Total USDC locked as agent performance bonds for unsettled jobs. ([contracts/AGIJobManager.sol#L344](../../contracts/AGIJobManager.sol#L344))
- @notice Total USDC locked as validator bonds for unsettled votes. ([contracts/AGIJobManager.sol#L346](../../contracts/AGIJobManager.sol#L346))
- @notice Total USDC locked as dispute bonds for unsettled disputes. ([contracts/AGIJobManager.sol#L348](../../contracts/AGIJobManager.sol#L348))
- @notice Freezes ENS/namewrapper/root nodes; USDC is immutable at deployment. Not a governance lock; ops remain owner-controlled. ([contracts/AGIJobManager.sol#L362](../../contracts/AGIJobManager.sol#L362))
- @notice Anyone may lock ENS records after a job reaches a terminal state; only the owner may burn fuses. ([contracts/AGIJobManager.sol#L1277](../../contracts/AGIJobManager.sol#L1277))
- @dev Fuse burning is irreversible and remains owner-only; ENS hook execution is best-effort. ([contracts/AGIJobManager.sol#L1278](../../contracts/AGIJobManager.sol#L1278))
- @dev Owner withdrawals are limited to balances not backing lockedEscrow/locked*Bonds. ([contracts/AGIJobManager.sol#L1508](../../contracts/AGIJobManager.sol#L1508))
- @notice Prefix used when constructing ENS job labels as prefix + decimal(jobId). ([contracts/ens/ENSJobPages.sol#L117](../../contracts/ens/ENSJobPages.sol#L117))
- @notice Updates the default prefix used for unsnapshotted/future job ENS labels. ([contracts/ens/ENSJobPages.sol#L148](../../contracts/ens/ENSJobPages.sol#L148))
-      Legacy jobs that predate this contract must be migrated before hooks can mutate ENS records. ([contracts/ens/ENSJobPages.sol#L809](../../contracts/ens/ENSJobPages.sol#L809))

