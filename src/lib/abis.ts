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
  "function redeem(uint256 shares, address receiver, address owner) returns (uint256)",
  "function revealPlanKey(bytes32 entryId, bytes32 key)",
  "function setFee(uint16 newFeeBps)",
  "function setMaxShift(uint16 newMaxShiftBps)",
  "function quarantinedCount() view returns (uint256)",
  "function quarantined(address adapter) view returns (bool)",
  "function sessionBudgetBps() view returns (uint16)",
  "function sessionWindowStart() view returns (uint64)",
  "function sessionWindowShifted() view returns (uint256)",
  "function restoreAdapter(address adapter)",
  "function style() view returns (bytes32)",
  "function setStyle(bytes32 newStyle)",
  "event AdapterQuarantined(address indexed adapter)",
  "event AdapterRestored(address indexed adapter, uint256 assets)",
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

/** Adapter bersetelan (TunedMirrorAdapter): setelan kota disimpan di adapter; hanya walikota atau wakilnya yang boleh mengubah. */
export const tunedAdapterAbi = parseAbi([
  "function baseSourceId() view returns (bytes32)",
  "function tuning() view returns (bytes)",
  "function tunedAt() view returns (uint64)",
  "function setTuning(bytes newTuning)",
  "event TuningSet(address indexed vault, address indexed by, bytes tuning)",
]);

/** Loket kota (CityServices): Panggung (peluncur token dengan kurva harga); prediksi dikunci di kontrak yang di-deploy. */
export const cityServicesAbi = parseAbi([
  "function services(address city, uint8 kind) view returns (bool on, uint16 feeBps)",
  "function stats(address city, uint8 kind) view returns (uint128 volume, uint128 fees, uint64 uses)",
  "function setService(address city, uint8 kind, bool on, uint16 feeBps)",
  "function launchFee() view returns (uint256)",
  "function MAX_FEE_BPS() view returns (uint16)",
  "function predictionEnabled() view returns (bool)",
  "function launch(address city, string name, string symbol, uint256 buyAmount, uint256 minTokens) returns (address token, uint256 tokensOut)",
  "function buy(address token, uint256 amount, uint256 minTokens) returns (uint256 tokensOut)",
  "function sell(address token, uint256 tokensIn, uint256 minOut) returns (uint256 out)",
  "function quoteBuy(address token, uint256 amount) view returns (uint256 tokensOut, uint256 fee)",
  "function quoteSell(address token, uint256 tokensIn) view returns (uint256 out, uint256 fee)",
  "function price(address token) view returns (uint256)",
  "function tokensOf(address city) view returns (address[])",
  "function curves(address token) view returns (address city, uint256 reserve, uint256 tokens)",
  "function releasable(address city) view returns (uint256 due, uint256 pending)",
  "function release(address city) returns (uint256)",
  "event TokenLaunched(address indexed city, address indexed token, address indexed creator, string name, string symbol)",
  "event Traded(address indexed city, address indexed token, address indexed user, bool buy, uint256 ausd, uint256 tokens, uint256 fee)",
]);

export const apyFeedAbi = parseAbi([
  "function latest(bytes32 sourceId) view returns (uint32 apyBps, uint64 observedAt, uint64 updatedAt)",
  "function sourceLabel(bytes32 sourceId) view returns (string)",
]);

export const erc20Abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
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

export const marketplaceAbi = parseAbi([
  "function hire(uint256 listingId, uint64 periods, bytes32 expectedTerms, address hook, bytes data) returns (uint64)",
  "function hireWithPermit(uint256 listingId, uint64 periods, bytes32 expectedTerms, address hook, bytes data, uint256 deadline, uint8 v, bytes32 r, bytes32 s) returns (uint64)",
  "function termsHash(uint256 listingId) view returns (bytes32)",
]);

/** ERC-8004 Reputation Registry (testnet): walikota menilai agen yang ia sewa; registri menolak penilaian dari pemilik agen. */
export const reputationAbi = parseAbi([
  "function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)",
]);
