# ENS Reference (Generated)

Generated at (UTC): 1970-01-01T00:00:00Z
Source fingerprint: d13b3262211e8927

Source files used:
- `contracts/AGIJobManager.sol`
- `contracts/utils/ENSOwnership.sol`
- `contracts/ens/ENSJobPages.sol`
- `contracts/ens/IENSJobPages.sol`

## ENS surface area

- `bytes32 public clubRootNode;` ([contracts/AGIJobManager.sol#L394](../../contracts/AGIJobManager.sol#L394))
- `bytes32 public alphaClubRootNode;` ([contracts/AGIJobManager.sol#L395](../../contracts/AGIJobManager.sol#L395))
- `bytes32 public agentRootNode;` ([contracts/AGIJobManager.sol#L396](../../contracts/AGIJobManager.sol#L396))
- `bytes32 public alphaAgentRootNode;` ([contracts/AGIJobManager.sol#L397](../../contracts/AGIJobManager.sol#L397))
- `bytes32 public validatorMerkleRoot;` ([contracts/AGIJobManager.sol#L398](../../contracts/AGIJobManager.sol#L398))
- `bytes32 public agentMerkleRoot;` ([contracts/AGIJobManager.sol#L399](../../contracts/AGIJobManager.sol#L399))
- `ENS public ens;` ([contracts/AGIJobManager.sol#L400](../../contracts/AGIJobManager.sol#L400))
- `NameWrapper public nameWrapper;` ([contracts/AGIJobManager.sol#L401](../../contracts/AGIJobManager.sol#L401))
- `address public ensJobPages;` ([contracts/AGIJobManager.sol#L402](../../contracts/AGIJobManager.sol#L402))
- `bool public lockIdentityConfig;` ([contracts/AGIJobManager.sol#L405](../../contracts/AGIJobManager.sol#L405))
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

- `function _initRoots(bytes32[4] memory rootNodes, bytes32[2] memory merkleRoots) internal` ([contracts/AGIJobManager.sol#L580](../../contracts/AGIJobManager.sol#L580))
- `function lockIdentityConfiguration() external onlyOwner whenIdentityConfigurable` ([contracts/AGIJobManager.sol#L738](../../contracts/AGIJobManager.sol#L738))
- `function applyForJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof)` ([contracts/AGIJobManager.sol#L770](../../contracts/AGIJobManager.sol#L770))
- `function validateJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof)` ([contracts/AGIJobManager.sol#L832](../../contracts/AGIJobManager.sol#L832))
- `function disapproveJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof)` ([contracts/AGIJobManager.sol#L840](../../contracts/AGIJobManager.sol#L840))
- `function updateAGITokenAddress(address _newTokenAddress) external onlyOwner whenIdentityConfigurable` ([contracts/AGIJobManager.sol#L1033](../../contracts/AGIJobManager.sol#L1033))
- `function updateEnsRegistry(address _newEnsRegistry) external onlyOwner whenIdentityConfigurable` ([contracts/AGIJobManager.sol#L1040](../../contracts/AGIJobManager.sol#L1040))
- `function updateNameWrapper(address _newNameWrapper) external onlyOwner whenIdentityConfigurable` ([contracts/AGIJobManager.sol#L1046](../../contracts/AGIJobManager.sol#L1046))
- `function setEnsJobPages(address _ensJobPages) external onlyOwner whenIdentityConfigurable` ([contracts/AGIJobManager.sol#L1052](../../contracts/AGIJobManager.sol#L1052))
- `function updateRootNodes(` ([contracts/AGIJobManager.sol#L1061](../../contracts/AGIJobManager.sol#L1061))
- `function updateMerkleRoots(bytes32 _validatorMerkleRoot, bytes32 _agentMerkleRoot)` ([contracts/AGIJobManager.sol#L1074](../../contracts/AGIJobManager.sol#L1074))
- `function lockJobENS(uint256 jobId, bool burnFuses) external` ([contracts/AGIJobManager.sol#L1293](../../contracts/AGIJobManager.sol#L1293))
- `function tokenURI(uint256 tokenId) public view override returns (string memory)` ([contracts/AGIJobManager.sol#L1529](../../contracts/AGIJobManager.sol#L1529))
- `function _callEnsJobPagesHook(uint8 hook, uint256 jobId) internal` ([contracts/AGIJobManager.sol#L1534](../../contracts/AGIJobManager.sol#L1534))
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

- `error NotAuthorized();` ([contracts/AGIJobManager.sol#L333](../../contracts/AGIJobManager.sol#L333))
- `error InvalidParameters();` ([contracts/AGIJobManager.sol#L335](../../contracts/AGIJobManager.sol#L335))
- `error ConfigLocked();` ([contracts/AGIJobManager.sol#L344](../../contracts/AGIJobManager.sol#L344))
- `event EnsRegistryUpdated(address newEnsRegistry);` ([contracts/AGIJobManager.sol#L477](../../contracts/AGIJobManager.sol#L477))
- `event RootNodesUpdated(` ([contracts/AGIJobManager.sol#L479](../../contracts/AGIJobManager.sol#L479))
- `event MerkleRootsUpdated(bytes32 validatorMerkleRoot, bytes32 agentMerkleRoot);` ([contracts/AGIJobManager.sol#L485](../../contracts/AGIJobManager.sol#L485))
- `event IdentityConfigurationLocked(address indexed locker, uint256 indexed atTimestamp);` ([contracts/AGIJobManager.sol#L492](../../contracts/AGIJobManager.sol#L492))
- `event EnsJobPagesUpdated(address indexed oldEnsJobPages, address indexed newEnsJobPages);` ([contracts/AGIJobManager.sol#L499](../../contracts/AGIJobManager.sol#L499))
- `event EnsHookAttempted(uint8 indexed hook, uint256 indexed jobId, address indexed target, bool success);` ([contracts/AGIJobManager.sol#L514](../../contracts/AGIJobManager.sol#L514))
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

- @notice Total AGI locked as agent performance bonds for unsettled jobs. ([contracts/AGIJobManager.sol#L386](../../contracts/AGIJobManager.sol#L386))
- @notice Total AGI locked as validator bonds for unsettled votes. ([contracts/AGIJobManager.sol#L388](../../contracts/AGIJobManager.sol#L388))
- @notice Total AGI locked as dispute bonds for unsettled disputes. ([contracts/AGIJobManager.sol#L390](../../contracts/AGIJobManager.sol#L390))
- @notice Freezes token/ENS/namewrapper/root nodes. Not a governance lock; ops remain owner-controlled. ([contracts/AGIJobManager.sol#L404](../../contracts/AGIJobManager.sol#L404))
- @notice Anyone may lock ENS records after a job reaches a terminal state; only the owner may burn fuses. ([contracts/AGIJobManager.sol#L1291](../../contracts/AGIJobManager.sol#L1291))
- @dev Fuse burning is irreversible and remains owner-only; ENS hook execution is best-effort. ([contracts/AGIJobManager.sol#L1292](../../contracts/AGIJobManager.sol#L1292))
- @dev as long as lockedEscrow/locked*Bonds are fully covered. ([contracts/AGIJobManager.sol#L1339](../../contracts/AGIJobManager.sol#L1339))
- @dev Owner withdrawals are limited to balances not backing lockedEscrow/locked*Bonds. ([contracts/AGIJobManager.sol#L1564](../../contracts/AGIJobManager.sol#L1564))
- @notice Prefix used when constructing ENS job labels as prefix + decimal(jobId). ([contracts/ens/ENSJobPages.sol#L117](../../contracts/ens/ENSJobPages.sol#L117))
- @notice Updates the default prefix used for unsnapshotted/future job ENS labels. ([contracts/ens/ENSJobPages.sol#L148](../../contracts/ens/ENSJobPages.sol#L148))
-      Legacy jobs that predate this contract must be migrated before hooks can mutate ENS records. ([contracts/ens/ENSJobPages.sol#L809](../../contracts/ens/ENSJobPages.sol#L809))

