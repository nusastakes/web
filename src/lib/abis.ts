import { parseAbi } from "viem";

/** Hanya fungsi dan event yang dipakai frontend. Sumber kebenaran: kontrak di nusastakes/contracts. */

export const factoryAbi = parseAbi([
  "struct CityInfo { address vault; address mayor; string name; string community; string mapURI; uint16 feeBps; uint64 createdAt; uint256 totalAssets; uint256 totalSupply; uint256 pricePerShare; address[] adapters; }",
  "function cityCount() view returns (uint256)",
  "function cityInfos(uint256 start, uint256 count) view returns (CityInfo[] infos)",
  "function createCity(string name, string community, uint16 feeBps, address[] adapterImpls, string mapURI) returns (address vault)",
  "function maxFeeBps() view returns (uint16)",
  "function depositCap() view returns (uint256)",
  "function allowedAdapterImpl(address impl) view returns (bool)",
  "event CityCreated(address indexed vault, address indexed mayor, string name, string community, uint16 feeBps, string mapURI)",
]);

export const vaultAbi = parseAbi([
  "function name() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalAssets() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function previewRedeem(uint256 shares) view returns (uint256)",
  "function maxDeposit(address receiver) view returns (uint256)",
  "function pricePerShare() view returns (uint256)",
  "function nonces(address owner) view returns (uint256)",
  "function mayor() view returns (address)",
  "function feeBps() view returns (uint16)",
  "function maxShiftBps() view returns (uint16)",
  "function sessionKey() view returns (address)",
  "function sessionKeyExpiry() view returns (uint64)",
  "function sessionKeyMaxShiftBps() view returns (uint16)",
  "event SessionKeySet(address indexed sessionKey, uint64 expiry, uint16 maxShiftBps)",
  "function adapters() view returns (address[])",
  "function rebalance(address from, address to, uint256 amount, bytes32 planHash)",
  "function setSessionKey(address newSessionKey, uint64 expiry, uint16 shiftBps)",
  "function harvestFee()",
  "function revealPlanKey(bytes32 entryId, bytes32 key)",
  "function setFee(uint16 newFeeBps)",
  "function setMaxShift(uint16 newMaxShiftBps)",
  "event PlanKeyRevealed(bytes32 indexed entryId, bytes32 key)",
  "event FeeSet(uint16 oldFeeBps, uint16 newFeeBps)",
  "event Rebalanced(address indexed caller, address indexed from, address indexed to, uint256 amount, bytes32 planHash)",
  "event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)",
  "event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)",
  "event FeeAccrued(uint256 feeShares, uint256 platformShares, uint256 mayorShares, uint256 newHighWaterMark)",
  "event Evacuated(address indexed adapter, uint256 amount)",
]);

export const adapterAbi = parseAbi([
  "function totalAssets() view returns (uint256)",
  "function isSimulated() view returns (bool)",
  "function sourceId() view returns (bytes32)",
]);

export const apyFeedAbi = parseAbi([
  "function latest(bytes32 sourceId) view returns (uint32 apyBps, uint64 observedAt, uint64 updatedAt)",
  "function sourceLabel(bytes32 sourceId) view returns (string)",
]);

export const erc20Abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function nonces(address owner) view returns (uint256)",
  "function eip712Domain() view returns (bytes1 fields, string name, string version, uint256 chainId, address verifyingContract, bytes32 salt, uint256[] extensions)",
]);

export const guardianAbi = parseAbi([
  "function grantAgent(address city, address agent, uint8 role, uint64 expiry)",
  "function revokeAgent(address city, address agent)",
  "function agents(address city, address agent) view returns (uint8 role, uint64 expiry)",
  "function isActiveAgent(address city, address agent, uint8 role) view returns (bool)",
  "function approve(address city, uint256 id)",
  "event AgentGranted(address indexed city, address indexed agent, uint8 role, uint64 expiry)",
  "event AgentRevoked(address indexed city, address indexed agent)",
  "event EvacuationRequested(address indexed city, address indexed adapter, address indexed requester, bytes32 planHash)",
  "event ProposalCreated(uint256 indexed id, address indexed city, address indexed proposer, address from, address to, uint256 amount, bytes32 planHash)",
  "event ProposalApproved(uint256 indexed id, address indexed city, bytes32 planHash)",
]);
