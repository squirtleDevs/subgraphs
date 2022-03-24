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

  let user = User.load(to);
  const tokenId = event.params.tokenId.toString();
  const collection = createOrLoadCollection(MERGE_EXTADDR);

  if (!user) {
    user = new User(to);
    collection.totalUniqueOwnerAddresses++;
    collection.save();
    user.save();
    if (to == NG_OMNIBUS) {
      user.whitelist = true;
    }
  }

  let scenario: string;
  if (from == EMPTY_ADDRESS && to == NG_OMNIBUS) {
    const contract = Merge.bind(event.address);
    const nftValue = contract.getValueOf(event.params.tokenId);
    // assign user.id to nft.owner within handleTransfer()
    const nft = createOrGetNFT(tokenId, nftValue);
    nft.owner = user.id;
    scenario = "Mint";
    nft.save();
    updateCollection(tokenId, scenario);
  } else if (to == EMPTY_ADDRESS && from == NG_OMNIBUS) {
    scenario = "NiftyBurn";
    updateNFT(tokenId, user.id);
    updateCollection(tokenId, scenario);
  } else if (to == EMPTY_ADDRESS) {
    scenario = "NonNiftyBurn";
    updateNFT(tokenId, user.id);
    updateCollection(tokenId, scenario);
  } else if (from == ADDR_DEAD) {
    scenario = "StraightBurn";
    updateCollection(tokenId, scenario);
  } else if (!(from == NG_OMNIBUS && to != EMPTY_ADDRESS && to != ADDR_DEAD)) {
    scenario = "normTransfer"; //transfer to someone who doesn't own a mergeNFT yet
    updateNFT(tokenId, user.id);
    collection.totalUniqueOwnerAddresses--; // to counterbalance the ++ when making this new user entity.
    collection.save();
  }

  user.save();
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
  const collection = Collection.load(MERGE_EXTADDR) as Collection;
  if (nft.isAlpha) {
    nft.mass = event.params.alphaMass;
    nft.save();
    return;
  } else {
    // takes title of Alpha away from old alpha token
    const oldAlphaId = collection.alphaTokenId as string;
    const oldAlphaNFT = NFT.load(oldAlphaId) as NFT;
    oldAlphaNFT.isAlpha = false;
    const tier = oldAlphaNFT.tier;
    oldAlphaNFT.color = checkColor(tier);
    oldAlphaNFT.save();
    // update new alpha!

    nft.mass = event.params.alphaMass;
    nft.isAlpha = true;
    nft.color = "BLACK";
    const scenario = "Alpha";
    updateCollection(alphaTokenId, scenario);

    nft.save();
  }
}

/**
 * @notice when merges are truly taken record of
 * @param event MassUpdate
 * @dev TODO: nice to have --> fix decodeValues() commented out code at bottom of function
 */
export function handleMassUpdate(event: MassUpdate): void {
  const tokenIdBurned = event.params.tokenIdBurned.toString();
  const tokenIdPersist = event.params.tokenIdPersist.toString();
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

  // update mergeTimes array
  const mergeTimesPersist = nftPersist.mergeTimes;
  mergeTimesPersist.push(event.block.timestamp.toI32());
  nftPersist.mergeTimes = mergeTimesPersist;

  // update mergeCount, mass, color, tier of nftPersist
  nftPersist.mergeCount++;
  nftPersist.mass = (updatedValue % CLASS_MULTIPLIER) as BigInt;
  const bigIntTier: BigInt = updatedValue / CLASS_MULTIPLIER;
  const tier: string = checkMergeClass(bigIntTier);
  nftPersist.tier = tier;
  nftPersist.color = checkColor(tier);

  // update collection
  const scenario = "Merge";
  updateCollection(nftBurned.id, scenario);

  nftBurned.save();
  nftPersist.save();

  // TODO: when decodeValue() works, may have to tweak as I haven't looked at it in a bit.

  // nftPersist.mass = decodeValue(
  //   updatedValue
  // ).mass;
  // nftPersist.color = decodeValue(updatedValue).color;
  // nftPersist.tier = decodeValue(updatedValue).tier;
}

/* ========== CALL HANDLERS ========== */

export function handleWhitelistUpdate(call: WhitelistUpdateCall): void {
  const address = call.inputs.address_.toHexString();
  const status = call.inputs.status;

  const user = User.load(address) as User;

  user.whitelist = status;
  user.save();
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
function updateNFT(tokenId: string, userId: string): NFT {
  const nft = NFT.load(tokenId) as NFT;
  nft.owner = userId;
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
  const nft = NFT.load(tokenId);
  if (nft == null) {
    const nft = new NFT(tokenId);
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
  }
  return nft as NFT;
}

/**
 * @notice initializes collection data
 * @param extAddr hexstring of ext address of contract
 * @returns newly initialized collection entity
 */
function createOrLoadCollection(extAddr: string): Collection {
  const collection = Collection.load(extAddr);
  if (collection == null) {
    // initialize constants for collection
    const collection = new Collection(extAddr);
    collection.name = MERGE_NAME;
    collection.tokenStandard = TOKENSTANDARD;
    collection.totalUniqueOwnerAddresses = 0;
    collection.initialNFTTotal = 0;
    collection.tier1Totals = 0;
    collection.tier2Totals = 0;
    collection.tier3Totals = 0;
    collection.tier4Totals = 0;
    collection.totalBurns = 0;
    collection.mergeNFTsATM = 0;
    collection.totalMerges = 0;
    collection.totalMass = BIGINT_ZERO;
    collection.originalMass = BIGINT_ZERO;
    collection.save();
  }
  return collection as Collection;
}

// * @dev TODO: edge case, if there are no longer any NFTs within NG ownership.
//increment or decrement merge. collection entity

/**
 *
 * @param tokenId
 * @param scenario whether Mint, NonNiftyBurn, NiftyBurn, StraightBurn, Merge, Alpha.
 */
function updateCollection(tokenId: string, scenario: string): void {
  // let collection = Collection.load(MERGE_EXTADDR);
  const collection = createOrLoadCollection(MERGE_EXTADDR);
  // if (!collection) {
  //   collection = createCollection(MERGE_EXTADDR); // NEW for collection entity - first instance of minting merge.
  // }

  const nft = NFT.load(tokenId) as NFT;

  const tier = nft.tier;

  if (scenario == "Mint") {
    // update NFT count in beginning of merge collection, NOTE: this is where I wonder if I am off by 1 for some reason. Perhaps they started the count with 1, instead of 0 for some reason.
    collection.initialNFTTotal++;
    collection.mergeNFTsATM++;

    collection.originalMass = collection.originalMass.plus(nft.mass);
    collection.totalMass = collection.totalMass.plus(nft.mass);

    if (tier == "ONE") {
      collection.tier1Totals++;
    } else if (tier == "TWO") {
      collection.tier2Totals++;
    } else if (tier == "THREE") {
      collection.tier3Totals++;
    } else if (tier == "FOUR") {
      collection.tier4Totals++;
    }
    collection.save();
    // TODO: LESSON - if you save an entity but are not done the function call, and then call another function and try loading that newly saved entity, it will not update the same entity with the helper function stuff. Keep it all in the same block of scope.
    // tallyTier(tier, scenario);
  } else if (scenario == "NonNiftyBurn" || scenario == "NiftyBurn" || scenario == "StraightBurn") {
    if (tier == "ONE") {
      collection.tier1Totals--;
    } else if (tier == "TWO") {
      collection.tier2Totals--;
    } else if (tier == "THREE") {
      collection.tier3Totals--;
    } else if (tier == "FOUR") {
      collection.tier4Totals--;
    }

    collection.mergeNFTsATM--;
    collection.totalBurns++;

    if (scenario == "NonNiftyBurn") {
      collection.totalUniqueOwnerAddresses--;
    }
    if (scenario == "StraightBurn") {
      collection.totalMass = collection.totalMass.minus(nft.mass);
      collection.totalUniqueOwnerAddresses--;
    }
  } else if (scenario == "Merge") {
    collection.totalMerges++;
  } else if (scenario == "Alpha") {
    collection.alphaTokenId = tokenId;
  }
  collection.save();
}

/* ========== HELPER FUNCTIONS ========== */

/**
 * @notice sort color of nft based on massClass
 * @param massClass corresponding to the enum Class from schema
 * @returns Color: string
 */
function checkColor(_tier: string): string {
  let color: string;
  color = "WHITE";

  if (_tier == "ONE") {
    return color;
  } else if (_tier == "TWO") {
    color = "YELLOW";
  } else if (_tier == "THREE") {
    color = "BLUE";
  } else if (_tier == "FOUR") {
    color = "RED";
  }

  return color;
}

/**
 * @notice sort tier as a string to fit schema enum reqs
 * @param _tier
 * @returns tier: string
 */
function checkMergeClass(_tier: BigInt): string {
  let tier: string;
  tier = "ONE";

  if (_tier == BigInt.fromI32(1)) {
    return tier;
  } else if (_tier == BigInt.fromI32(2)) {
    tier = "TWO";
  } else if (_tier == BigInt.fromI32(3)) {
    tier = "THREE";
  } else if (_tier == BigInt.fromI32(4)) {
    tier = "FOUR";
  }

  return tier;
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

/* ========== NICE TO HAVE IMPROVEMENT FUNCTIONS ========== */

// THESE FUNCTIONS WOULD BE GREAT TO HAVE AFTER I GET THE CORE IMPLEMENTATION DONE FOR THE SUBGRAPH. LEAVING IT HERE FOR REFERENCE THOUGH.

/* ========== FROM UPDATE 1 ========== */

// /**
//  * @notice object type where properties represent value-based-decoded nft metadata
//  * TODO: not sure but I am getting a compile error here. Asked DK. I need to just look into this. This will be done in next PR as I clean up the code.
//  */
// type Values = {
//   mass: BigInt;
//   tier: string;
//   color: string;
// };

// /**
//  * @notice carries out decoding of value for a particular mass NFT
//  * @returns value : Values
//  * @dev TODO: see Object Type Values above and the error that is there. Once that is resolved then this can be used.
//  */
// function decodeValue(nftValue: BigInt): Values {
//   let value: Values;
//   let _tier: BigInt = nftValue / CLASS_MULTIPLIER;
//   let tier = checkMergeClass(_tier);

//   value = {
//     mass: (nftValue % CLASS_MULTIPLIER) as BigInt,
//     tier: tier,
//     color: checkColor(tier),
//   };

//   return value;
// }

/* ========== FROM UPDATE 2 ========== */

// /**
//  * @notice Update 2 - renders svg art using similar methods as smart contract with key attributes of tokenId
//  * @param
//  * @dev TODO: this is to be added in last for the subgraph
//  */
// function renderSVG(): void {
//   // recall how: public fn tokenURI() gets a return from inherited fn tokenMetadata.
//   // then fn tokenMetadata() gets a string that is an base64 encoded JSON. This JSON contains, call it base64JSON, has all attributes and even the image data within it. The code seems to show that this base64JSON is actually an ecoding of the initial JSON that has aforementioned metadata.
//   // the image is generated in fn private _getSvg() within private fn _getJson()
//   // TODO: write implementation code for renderSVG() by referencing _getSvg() where a string is returned. This string arguably could just be encoded twice and it should be in a format that is able to be rendered by a marketplace.
// }

/* ========== FROM UPDATE 3 ========== */

// Instead of updating the tierTotals and BurnDetails within the EventHandlers themselves, I had made these separate helper functions. They caused issues though because I learnt:    // TODO: LESSON - if you save an entity but are not done the function call, and then call another function and try loading that newly saved entity, it will not update the same entity with the helper function stuff. Keep it all in the same block of scope.
// tallyTier(tier, scenario);

// /**
//  * @notice increments or decrements respective tier tally within collection
//  * @param tier
//  * @param scenario
//  */
// function tallyTier(tier: string, scenario: string): void {
//   const collection = Collection.load(MERGE_EXTADDR) as Collection;

//   // update tier counts
//   if (scenario == "Mint" && tier == "ONE") {
//     collection.tier1Totals++;
//     collection.save();
//   } else if (scenario == "Mint" && tier == "TWO") {
//     collection.tier2Totals++;
//     collection.save();
//   } else if (scenario == "Mint" && tier == "THREE") {
//     collection.tier3Totals++;
//     collection.save();
//   } else if (scenario == "Mint" && tier == "FOUR") {
//     collection.tier4Totals++;
//     collection.save();
//   } else if (tier == "ONE") {
//     collection.tier1Totals--;
//     collection.save();
//   } else if (tier == "TWO") {
//     collection.tier2Totals--;
//     collection.save();
//   } else if (tier == "THREE") {
//     collection.tier3Totals--;
//     collection.save();
//   } else if (tier == "FOUR") {
//     collection.tier4Totals--;
//     collection.save();
//   }
// }

// /**
//  * @notice keeps tally of collection details as burns happen
//  * @param scenario
//  * @dev TODO: check this over, nft is not declared.
//  */
// function tallyBurnDetails(tokenId: string, scenario: string): void {
//   const collection = Collection.load(MERGE_EXTADDR) as Collection;
//   const nft = NFT.load(tokenId) as NFT;

//   if (scenario == "NonNiftyBurn" || scenario == "NiftyBurn") {
//     collection.mergeNFTsATM--;
//     collection.totalBurns++;
//     collection.totalMass = collection.totalMass.minus(nft.mass);
//   }

//   collection.save();
// }
