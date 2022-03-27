import { BigInt } from "@graphprotocol/graph-ts";
import {
  Merge,
  Transfer,
  AlphaMassUpdate,
  MassUpdate,
  WhitelistUpdateCall,
  Approval,
  ApprovalForAll,
  ConsecutiveTransfer,
  BurnCall,
} from "../generated/Merge/Merge";
import { User, NFT, Collection } from "../generated/schema";
import {
  EMPTY_ADDRESS,
  CLASS_MULTIPLIER,
  NG_OMNIBUS,
  MERGE_EXTADDR,
  MERGE_NAME,
  TOKENSTANDARD,
  BIGINT_ZERO,
  ADDR_DEAD,
} from "./utils";

/* ========== EVENT HANDLERS ========== */

/**
 * @notice handles Transfer events and ultimately instantiates / updates User and NFT entities
 * @param event: Transfer
 * @dev all NFT entity generation is handled in other functions.
 * Step 0 && Step 1: set NG_OMNIBUS as a whitelisted address as it is done in the constructor, and initialize new users
 * Step 2a: either create new NFT if in minting phase
 * Step 2b: OR updateNFT for all other Transfer scenarios incl: temporary transfers right before merging/burning, simple burning (direct to dead address, which then transfers to address(0))
 * NOTE: MassUpdates will cover the merge scenario.
 */
export function handleTransfer(event: Transfer): void {
  const to = event.params.to.toHex();
  const from = event.params.from.toHex();
  const tokenId = event.params.tokenId.toString();
  const collection = createOrLoadCollection(MERGE_EXTADDR);
  let user = User.load(to);

  if (!user) {
    user = new User(to);
    collection.totalUniqueOwnerAddresses++;
    collection.save();
    if (to == NG_OMNIBUS) {
      user.whitelist = true;
    }
    user.save();
  }

  let scenario: string;
  let nftValue: BigInt;

  if (from == EMPTY_ADDRESS && to == NG_OMNIBUS) {
    const contract = Merge.bind(event.address);
    nftValue = contract.getValueOf(event.params.tokenId);
    scenario = "Mint";
  } else {
    nftValue = BIGINT_ZERO;
  }

  //TODO: Figure out how to clean up this nested if statement without overwriting when mints are happening.
  if (scenario != "Mint") {
    if (to == EMPTY_ADDRESS && from == NG_OMNIBUS) {
      scenario = "NiftyBurn";
    } else if (to == EMPTY_ADDRESS) {
      scenario = "NonNiftyBurn";
    } else if (from == ADDR_DEAD) {
      scenario = "StraightBurn";
    } else if (!(from == NG_OMNIBUS && to != EMPTY_ADDRESS && to != ADDR_DEAD)) {
      scenario = "normTransfer"; //transfer to someone who doesn't own a mergeNFT yet
    }
  }

  updateNFT(tokenId, user.id, nftValue);
  updateCollection(tokenId, scenario);
}

/**
 * @notice updates when new alphaMass identified
 * @param event AlphaMassUpdate
 * @dev NOTE: `nft.value` is updated for the respective entity (old or new alpha) within either MassUpdate or Transfer event (when minting) as per the smart contract logic. I am assuming that
 * the title of 'alpha' was given when minting phase was done though. With that assumption, I believe we have our bases covered for ensuring that value will ultimately be updated for the old or new alpha.
 */
export function handleAlphaMassUpdate(event: AlphaMassUpdate): void {
  const alphaTokenId = event.params.tokenId.toString();
  const nft = createOrGetNFT(alphaTokenId, BIGINT_ZERO);
  //update mass for alpha regardless of new or oldAlpha
  nft.mass = event.params.alphaMass;

  if (!nft.isAlpha) {
    const collection = createOrLoadCollection(MERGE_EXTADDR);
    // takes title of Alpha away from old alpha token
    const oldAlphaId = collection.alphaTokenId;
    const oldAlphaNFT = createOrGetNFT(oldAlphaId, BIGINT_ZERO);
    oldAlphaNFT.isAlpha = false;
    const tier = oldAlphaNFT.tier;
    oldAlphaNFT.color = checkColor(tier);
    oldAlphaNFT.save();
    // update new alpha!
    nft.isAlpha = true;
    nft.color = "BLACK";
    const scenario = "Alpha";
    updateCollection(alphaTokenId, scenario);
  }

  nft.save();
}

/**
 * @notice when merges are truly taken record of
 * @param event MassUpdate
 */
export function handleMassUpdate(event: MassUpdate): void {
  const tokenIdBurned = event.params.tokenIdBurned.toString();
  const tokenIdPersist = event.params.tokenIdPersist.toString();

  // TODO: repeat code (createOrGetNFT)
  const nftBurned = createOrGetNFT(tokenIdBurned, BIGINT_ZERO);
  const nftPersist = createOrGetNFT(tokenIdPersist, BIGINT_ZERO);

  // update value field for nftPersist
  const updatedValue = nftBurned.mass.plus(nftPersist.value);
  nftPersist.value = updatedValue;
  nftBurned.mergedInto = tokenIdPersist;

  // update absorbedNFTs array
  const newAbsorbedNFTs = nftPersist.absorbedNFTs;
  newAbsorbedNFTs.push(tokenIdBurned);
  nftPersist.absorbedNFTs = newAbsorbedNFTs;
  nftBurned.save();

  // update mergeTimes array
  const mergeTimesPersist = nftPersist.mergeTimes;
  mergeTimesPersist.push(event.block.timestamp.toI32());
  nftPersist.mergeTimes = mergeTimesPersist;

  // update mergeCount, mass, color, tier of nftPersist
  nftPersist.mergeCount++;
  nftPersist.mass = (updatedValue % CLASS_MULTIPLIER) as BigInt; // NOTE: during a alphaMassUpdate scenario, this already is updated actually. Edge case but doesn't matter (just redundant code in that scenario).
  const bigIntTier = updatedValue / CLASS_MULTIPLIER;
  const tier = checkMergeClass(bigIntTier);
  nftPersist.tier = tier;
  nftPersist.color = checkColor(tier);

  // update collection
  const scenario = "Merge";
  updateCollection(nftBurned.id, scenario);

  nftPersist.save();
}

/* ========== CALL HANDLERS ========== */

export function handleWhitelistUpdate(call: WhitelistUpdateCall): void {
  const user = User.load(call.inputs.address_.toHexString()) as User;
  user.whitelist = call.inputs.status;
  user.save();
}

export function handleBurn(call: BurnCall): void {
  const tokenId = call.inputs.tokenId.toHex();
  const scenario = "StraightBurn";

  updateNFT(tokenId, EMPTY_ADDRESS, BIGINT_ZERO);
  updateCollection(tokenId, scenario);
}

/* ========== GENERAL FUNCTIONS ========== */

/**
 * @notice load NFT or call createNFT() for new NFT
 * @param event: Transfer from handleTransfer() caller
 * @returns NFT with updated owner, or newly minted NFT entity
 * @dev NOTE: I thought about removing this but since I use value, a contract-bound-derived
 * metric, within `createOrGetNFT()` I pretty much felt that I should keep this helper function
 * to keep things simple.
 */
function updateNFT(tokenId: string, userId: string, nftValue: BigInt): NFT {
  const nft = createOrGetNFT(tokenId, nftValue);

  nft.owner = userId;

  // update NFT owner list
  const ownerList = nft.allOwners;
  ownerList.push(nft.owner);
  nft.allOwners = ownerList;

  nft.save();
  return nft;
}

/**
 * @notice create new NFT entity types upon mint or loads pre-existing NFT
 * @param tokenId signifying unique ID of token
 * @param nftValue encoded values for each, respective NFT, in the smart contracts
 * @return newly created or pre-exiseting NFT
 * @dev key thing is the nftValue variable that is the encoded value metric used within the smart
 * contracts to encode the mass and class data for each nft
 */
export function createOrGetNFT(tokenId: string, nftValue: BigInt): NFT {
  let nft = NFT.load(tokenId);
  if (nft != null) return nft;

  nft = new NFT(tokenId);
  // obtain nft fields throughs calculating off of encoded value
  nft.value = nftValue;
  nft.mass = (nftValue % CLASS_MULTIPLIER) as BigInt;
  const bigIntTier: BigInt = nftValue / CLASS_MULTIPLIER;
  const tier = checkMergeClass(bigIntTier);
  nft.tier = tier;
  nft.color = checkColor(tier);
  nft.isAlpha = false;
  nft.mergeCount = 0;
  nft.save();

  return nft;
}

/**
 * @notice initializes collection data
 * @param extAddr hexstring of ext address of contract
 * @returns newly initialized collection entity
 */
function createOrLoadCollection(extAddr: string): Collection {
  let collection = Collection.load(extAddr);
  if (collection != null) return collection;

  // initialize constants for collection
  collection = new Collection(extAddr);
  collection.name = MERGE_NAME;
  collection.tokenStandard = TOKENSTANDARD;
  collection.totalUniqueOwnerAddresses = 0;
  collection.initialNFTTotal = 0;
  collection.tier1Totals = 0;
  collection.tier2Totals = 0;
  collection.tier3Totals = 0;
  collection.tier4Totals = 0;
  collection.totalBurns = 0;
  collection.currentNFTs = 0;
  collection.totalMerges = 0;
  collection.totalMass = 0;
  collection.originalMass = 0;
  collection.alphaTokenId = "";
  collection.save();

  return collection;
}

/**
 * @notice update collection entity representing entire nft project
 * @param tokenId
 * @param scenario whether Mint, NonNiftyBurn, NiftyBurn, StraightBurn, Merge, Alpha.
 */
function updateCollection(tokenId: string, scenario: string): void {
  let collection = createOrLoadCollection(MERGE_EXTADDR);

  const nft = NFT.load(tokenId) as NFT;

  const tier = nft.tier;

  if (scenario == "Mint") {
    collection.initialNFTTotal++;
    collection.currentNFTs++;
    collection.originalMass = collection.originalMass + nft.mass.toI32();
    collection.totalMass = collection.totalMass + nft.mass.toI32();
  } else if (scenario == "Merge") {
    collection.totalMerges++;
  } else if (scenario == "Alpha") {
    collection.alphaTokenId = tokenId;
  } else if (scenario == "normTransfer") {
    collection.totalUniqueOwnerAddresses--; // to counterbalance the ++ when making this new user entity.
  } else if (scenario == "NiftyBurn") {
    collection = tallyBurnDetails(collection, tier); // for all burn scenarios
  } else if (scenario == "NonNiftyBurn") {
    collection = tallyBurnDetails(collection, tier); // for all burn scenarios
    collection.totalUniqueOwnerAddresses--;
  } else if (scenario == "StraightBurn") {
    collection = tallyBurnDetails(collection, tier); // for all burn scenarios
    collection.totalMass = collection.totalMass - nft.mass.toI32();
  }
  collection = tallyTier(tier, scenario, collection);
  collection.save();
}

/* ========== HELPER FUNCTIONS ========== */

/**
 * @notice sort color of nft based on massClass
 * @param massClass corresponding to the enum Class from schema
 * @returns Color: string
 */
function checkColor(_tier: string): string {
  if (_tier == "ONE") return "WHITE";
  if (_tier == "TWO") return "YELLOW";
  if (_tier == "THREE") return "BLUE";
  return "RED";
}

/**
 * @notice sort tier as a string to fit schema enum reqs
 * @param _tier
 * @returns tier: string
 */
function checkMergeClass(_tier: BigInt): string {
  if (_tier == BigInt.fromI32(1)) return "ONE";
  if (_tier == BigInt.fromI32(2)) return "TWO";
  if (_tier == BigInt.fromI32(3)) return "THREE";
  return "FOUR";
}

/**
 * @notice increments or decrements respective tier tally within collection
 * @param tier of nft
 * @param scenario representative of transfer type occurring
 * @param collection with partially updated fields
 * @returns collection, an updated collection entity
 */
function tallyTier(tier: string, scenario: string, collection: Collection): Collection {
  // update tier counts
  if (scenario == "Mint" && tier == "ONE") {
    collection.tier1Totals++;
  } else if (scenario == "Mint" && tier == "TWO") {
    collection.tier2Totals++;
  } else if (scenario == "Mint" && tier == "THREE") {
    collection.tier3Totals++;
  } else if (scenario == "Mint" && tier == "FOUR") {
    collection.tier4Totals++;
  }
  return collection;
}

/**
 * @notice changes burn-related counts as a helper function
 * @param collection with partially updated fields
 * @returns collection, an updated collection entity
 */
function tallyBurnDetails(collection: Collection, tier: string): Collection {
  if (tier == "ONE") {
    collection.tier1Totals--;
  } else if (tier == "TWO") {
    collection.tier2Totals--;
  } else if (tier == "THREE") {
    collection.tier3Totals--;
  } else if (tier == "FOUR") {
    collection.tier4Totals--;
  }

  collection.currentNFTs--;
  collection.totalBurns++;
  return collection;
}

/* ========== TBD EVENT HANDLER FUNCTIONS ========== */

/**
 * @notice
 */
export function handleApproval(event: Approval): void {}

/**
 * @notice
 */
export function handleApprovalForAll(event: ApprovalForAll): void {}

/**
 * @notice
 */
export function handleConsecutiveTransfer(event: ConsecutiveTransfer): void {}
