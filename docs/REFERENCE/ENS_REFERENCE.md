# ENS Reference (Generated)

Generated at (UTC): 1970-01-01T00:00:00Z
Source fingerprint: 69e4a154e36fe68c

Source files used:
- `contracts/AGIJobManager.sol`
- `contracts/utils/ENSOwnership.sol`
- `contracts/ens/ENSJobPages.sol`
- `contracts/ens/IENSJobPages.sol`

## ENS surface area

- `bytes32 public clubRootNode;` ([contracts/AGIJobManager.sol#L363](../../contracts/AGIJobManager.sol#L363))
- `bytes32 public alphaClubRootNode;` ([contracts/AGIJobManager.sol#L364](../../contracts/AGIJobManager.sol#L364))
- `bytes32 public agentRootNode;` ([contracts/AGIJobManager.sol#L365](../../contracts/AGIJobManager.sol#L365))
- `bytes32 public alphaAgentRootNode;` ([contracts/AGIJobManager.sol#L366](../../contracts/AGIJobManager.sol#L366))
- `bytes32 public validatorMerkleRoot;` ([contracts/AGIJobManager.sol#L367](../../contracts/AGIJobManager.sol#L367))
- `bytes32 public agentMerkleRoot;` ([contracts/AGIJobManager.sol#L368](../../contracts/AGIJobManager.sol#L368))
- `ENS public ens;` ([contracts/AGIJobManager.sol#L369](../../contracts/AGIJobManager.sol#L369))
- `NameWrapper public nameWrapper;` ([contracts/AGIJobManager.sol#L370](../../contracts/AGIJobManager.sol#L370))
- `address public ensJobPages;` ([contracts/AGIJobManager.sol#L371](../../contracts/AGIJobManager.sol#L371))
- `bool public lockIdentityConfig;` ([contracts/AGIJobManager.sol#L374](../../contracts/AGIJobManager.sol#L374))
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

- `function _initRoots(bytes32[4] memory rootNodes, bytes32[2] memory merkleRoots) internal` ([contracts/AGIJobManager.sol#L532](../../contracts/AGIJobManager.sol#L532))
- `function lockedEscrow() external view returns (uint256) { return ledger.escrow; }` ([contracts/AGIJobManager.sol#L752](../../contracts/AGIJobManager.sol#L752))
- `function lockedAgentBonds() external view returns (uint256) { return ledger.agentBonds; }` ([contracts/AGIJobManager.sol#L753](../../contracts/AGIJobManager.sol#L753))
- `function lockedValidatorBonds() external view returns (uint256) { return ledger.validatorBonds; }` ([contracts/AGIJobManager.sol#L754](../../contracts/AGIJobManager.sol#L754))
- `function lockedDisputeBonds() external view returns (uint256) { return ledger.disputeBonds; }` ([contracts/AGIJobManager.sol#L755](../../contracts/AGIJobManager.sol#L755))
- `function lockedClaims() external view returns (uint256) { return ledger.claims; }` ([contracts/AGIJobManager.sol#L756](../../contracts/AGIJobManager.sol#L756))
- `function lockIdentityConfiguration() external onlyOwner whenIdentityConfigurable` ([contracts/AGIJobManager.sol#L770](../../contracts/AGIJobManager.sol#L770))
- `function applyForJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof)` ([contracts/AGIJobManager.sol#L807](../../contracts/AGIJobManager.sol#L807))
- `function validateJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof)` ([contracts/AGIJobManager.sol#L870](../../contracts/AGIJobManager.sol#L870))
- `function disapproveJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof)` ([contracts/AGIJobManager.sol#L878](../../contracts/AGIJobManager.sol#L878))
- `function updateEnsRegistry(address _newEnsRegistry) external onlyOwner whenIdentityConfigurable` ([contracts/AGIJobManager.sol#L1030](../../contracts/AGIJobManager.sol#L1030))
- `function updateNameWrapper(address _newNameWrapper) external onlyOwner whenIdentityConfigurable` ([contracts/AGIJobManager.sol#L1036](../../contracts/AGIJobManager.sol#L1036))
- `function setEnsJobPages(address _ensJobPages) external onlyOwner whenIdentityConfigurable` ([contracts/AGIJobManager.sol#L1042](../../contracts/AGIJobManager.sol#L1042))
- `function updateRootNodes(` ([contracts/AGIJobManager.sol#L1051](../../contracts/AGIJobManager.sol#L1051))
- `function updateMerkleRoots(bytes32 _validatorMerkleRoot, bytes32 _agentMerkleRoot)` ([contracts/AGIJobManager.sol#L1064](../../contracts/AGIJobManager.sol#L1064))
- `function lockJobENS(uint256 jobId, bool burnFuses) external` ([contracts/AGIJobManager.sol#L1275](../../contracts/AGIJobManager.sol#L1275))
- `function tokenURI(uint256 tokenId) public view override returns (string memory)` ([contracts/AGIJobManager.sol#L1362](../../contracts/AGIJobManager.sol#L1362))
- `function _callEnsJobPagesHook(uint8 hook, uint256 jobId) internal` ([contracts/AGIJobManager.sol#L1367](../../contracts/AGIJobManager.sol#L1367))
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

- `error NotAuthorized();` ([contracts/AGIJobManager.sol#L298](../../contracts/AGIJobManager.sol#L298))
- `error InvalidParameters();` ([contracts/AGIJobManager.sol#L300](../../contracts/AGIJobManager.sol#L300))
- `error ConfigLocked();` ([contracts/AGIJobManager.sol#L309](../../contracts/AGIJobManager.sol#L309))
- `event EnsRegistryUpdated(address newEnsRegistry);` ([contracts/AGIJobManager.sol#L414](../../contracts/AGIJobManager.sol#L414))
- `event RootNodesUpdated(` ([contracts/AGIJobManager.sol#L416](../../contracts/AGIJobManager.sol#L416))
- `event MerkleRootsUpdated(bytes32 validatorMerkleRoot, bytes32 agentMerkleRoot);` ([contracts/AGIJobManager.sol#L422](../../contracts/AGIJobManager.sol#L422))
- `event IdentityConfigurationLocked(address indexed locker, uint256 indexed atTimestamp);` ([contracts/AGIJobManager.sol#L433](../../contracts/AGIJobManager.sol#L433))
- `event EnsJobPagesUpdated(address indexed oldEnsJobPages, address indexed newEnsJobPages);` ([contracts/AGIJobManager.sol#L439](../../contracts/AGIJobManager.sol#L439))
- `event EnsHookAttempted(uint8 indexed hook, uint256 indexed jobId, address indexed target, bool success);` ([contracts/AGIJobManager.sol#L454](../../contracts/AGIJobManager.sol#L454))
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

- @notice Total USDC locked as agent performance bonds for unsettled jobs. ([contracts/AGIJobManager.sol#L355](../../contracts/AGIJobManager.sol#L355))
- @notice Total USDC locked as validator bonds for unsettled votes. ([contracts/AGIJobManager.sol#L357](../../contracts/AGIJobManager.sol#L357))
- @notice Total USDC locked as dispute bonds for unsettled disputes. ([contracts/AGIJobManager.sol#L359](../../contracts/AGIJobManager.sol#L359))
- @notice Freezes ENS/namewrapper/root nodes; USDC is immutable at deployment. Not a governance lock; ops remain owner-controlled. ([contracts/AGIJobManager.sol#L373](../../contracts/AGIJobManager.sol#L373))
- @notice Total past and current settlement-pause time; all lifecycle clocks exclude it. ([contracts/AGIJobManager.sol#L696](../../contracts/AGIJobManager.sol#L696))
- @notice Current wall-clock deadlines; while paused they move forward as the clocks stop. ([contracts/AGIJobManager.sol#L713](../../contracts/AGIJobManager.sol#L713))
- @notice Explicit owner/Merkle exceptions issue an address credential; ENS uses node and controller. ([contracts/AGIJobManager.sol#L742](../../contracts/AGIJobManager.sol#L742))
- @notice Anyone may lock ENS records after a job reaches a terminal state; only the owner may burn fuses. ([contracts/AGIJobManager.sol#L1273](../../contracts/AGIJobManager.sol#L1273))
- @dev Fuse burning is irreversible and remains owner-only; ENS hook execution is best-effort. ([contracts/AGIJobManager.sol#L1274](../../contracts/AGIJobManager.sol#L1274))
- @dev Owner withdrawals are limited to balances not backing ledger.escrow/locked*Bonds. ([contracts/AGIJobManager.sol#L1397](../../contracts/AGIJobManager.sol#L1397))
- @notice Prefix used when constructing ENS job labels as prefix + decimal(jobId). ([contracts/ens/ENSJobPages.sol#L117](../../contracts/ens/ENSJobPages.sol#L117))
- @notice Updates the default prefix used for unsnapshotted/future job ENS labels. ([contracts/ens/ENSJobPages.sol#L148](../../contracts/ens/ENSJobPages.sol#L148))
-      Legacy jobs that predate this contract must be migrated before hooks can mutate ENS records. ([contracts/ens/ENSJobPages.sol#L810](../../contracts/ens/ENSJobPages.sol#L810))
- @notice Stable ENS credential and its controller for per-job voting uniqueness. ([contracts/utils/ENSOwnership.sol#L69](../../contracts/utils/ENSOwnership.sol#L69))

