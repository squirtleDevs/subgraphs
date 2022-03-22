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
import { EMPTY_ADDRESS, CLASS_MULTIPLIER, NG_OMNIBUS, MERGE_EXTADDR, MERGE_NAME, TOKENSTANDARD } from "./utils";

/* ========== HELPER FUNCTIONS ========== */

/**
 * @notice sort color of nft based on massClass
 * @param massClass corresponding to the enum Class from schema
 * @returns Color: string
 */
function checkColor(_tier: string, check: boolean): string {
  let color: string;
  color = "WHITE";

  if (check) {
    color = "BLACK";
    return color;
  } else if (_tier == "ONE") {
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

// /**
//  * @notice object type where properties represent value-based-decoded nft metadata
//  * TODO: not sure but I am getting a compile error here. Asked DK. I need to just look into this. This will be done in next PR as I clean up the code.
//  */
// type Values = {
//   mass: BigInt;
//   tier: string;
//   color: string;
// };

/**
 * @notice increments or decrements respective tier tally within collection
 * @param tier
 * @param scenario
 */
function tallyTier(tier: string, scenario: string): void {
  const collection = Collection.load(MERGE_EXTADDR) as Collection;

  // update tier counts
  if (scenario == "Mint") {
    if (tier == "ONE") {
      collection.tier1Totals++;
    } else if (tier == "TWO") {
      collection.tier2Totals++;
    } else if (tier == "THREE") {
      collection.tier3Totals++;
    } else if (tier == "FOUR") {
      collection.tier4Totals++;
    }
  } else {
    if (tier == "ONE") {
      collection.tier1Totals--;
    } else if (tier == "TWO") {
      collection.tier2Totals--;
    } else if (tier == "THREE") {
      collection.tier3Totals--;
    } else if (tier == "FOUR") {
      collection.tier4Totals--;
    }
  }

  collection.save();
}

/**
 * @notice keeps tally of collection details as burns happen
 * @param scenario
 * @dev TODO: check this over, nft is not declared.
 */
function tallyBurnDetails(tokenId: string, scenario: string): void {
  const collection = Collection.load(MERGE_EXTADDR) as Collection;
  const nft = NFT.load(tokenId) as NFT;

  if (scenario == "NonNiftyBurn" || scenario == "NiftyBurn") {
    collection.mergeNFTsATM--;
    collection.totalBurns++;
    collection.totalMass = collection.totalMass - nft.mass;
  }

  collection.save();
}

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

/* ========== EVENT HANDLERS ========== */

/**
 * @notice handles Transfer events and ultimately instantiates / updates User and NFT entities
 * @param event: Transfer
 * @dev all NFT entity generation is handled in other functions.
 */
export function handleTransfer(event: Transfer): void {
  const to = event.params.to.toHex();
  const from = event.params.from.toHex();

  let user = User.load(to);
  const tokenId = event.params.tokenId.toString();

  let collection = Collection.load(MERGE_EXTADDR) as Collection; // NEW for collection entity

  // Step 0 && Step 1: set NG_OMNIBUS as a whitelisted address as it is done in the constructor, and initialize new users
  if (!user) {
    user = new User(to);
    if (to == NG_OMNIBUS) {
      user.whitelist = true;
      collection = createCollection(MERGE_EXTADDR); // NEW for collection entity - first instance of minting merge.
    }
    collection.totalUniqueOwnerAddresses++; // NEW for collection entity
  }

  let nft: NFT;
  let scenario: string; // NEW for collection entity

  // Step 2a: either create new NFT if in minting phase
  if (from == EMPTY_ADDRESS && to == NG_OMNIBUS) {
    nft = createNFT(event, user.id);
    scenario = "Mint"; // NEW for collection entity
    collection = updateCollection(tokenId, scenario); // NEW for collection entity
  } else {
    // Step 2b: OR updateNFT for all other Transfer scenarios incl: temporary transfers right before merging/burning, simple burning (direct to dead address, which then transfers to address(0))
    // NEW for collection entity
    // it is either a burn, or it is a merge. MassUpdates will cover the merge scenario.

    if (to == EMPTY_ADDRESS) {
      if (from == NG_OMNIBUS) {
        scenario = "NiftyBurn";
      } else {
        scenario = "NonNiftyBurn";
      }
    } else {
      scenario = "normTransfer";
    }
    collection = updateCollection(tokenId, scenario);
    // transfer from one non NG user to another (either where new owner has a merge already, or doesn't, or from a non NG user to NG user). First, when a pre-merge transfer happens, we just update the user of the token, and then don't update the collection at all. NFTs can't be sent to Nifty accounts until the respective NFT has been sent to the OG owners Nifty account in the first place.
    // next is the transfer from one user to another... OK, unique owners doesn't increase, nor does massTotals, mergeNFT totals or anything.

    nft = updateNFT(tokenId, user.id);
  }
  user.save();
  nft.save();
  collection.save(); // NEW for collection entity
}

/**
 * @notice updates when new alphaMass identified
 * @param event AlphaMassUpdate
 * @dev TODO: need to handle the old alphaMass still. So if one tokenId is alpha one day, but the next a different one is, they will both have the 'isAlpha' field as 'true'
 * @dev TODO: add in scenario = "Alpha"
 */
export function handleAlphaMassUpdate(event: AlphaMassUpdate): void {
  const alphaTokenId = event.params.tokenId.toString();
  const nft = NFT.load(alphaTokenId) as NFT;

  nft.mass = event.params.alphaMass;
  nft.isAlpha = true;
  nft.color = checkColor(nft.value.toString(), nft.isAlpha);

  const collection = Collection.load(MERGE_EXTADDR) as Collection; // NEW for collection entity
  const scenario = "Alpha"; // NEW for collection entity

  updateCollection(alphaTokenId, scenario); // NEW for collection entity

  nft.save();
  collection.save();
}

/**
 * @notice when merges are truly taken record of
 * @param event MassUpdate
 * @dev TODO: fix decodeValues()
 */
export function handleMassUpdate(event: MassUpdate): void {
  const tokenIdBurned = event.params.tokenIdBurned.toString();
  const tokenIdPersist = event.params.tokenIdPersist.toString();

  const nftBurned = NFT.load(tokenIdBurned) as NFT;
  const nftPersist = NFT.load(tokenIdPersist) as NFT;

  const updatedValue = nftBurned.mass.plus(nftPersist.value);

  nftPersist.value = updatedValue;
  nftBurned.mergedInto = tokenIdPersist;

  const newAbsorbedNFTs = nftPersist.absorbedNFTs;
  newAbsorbedNFTs.push(tokenIdBurned);
  nftPersist.absorbedNFTs = newAbsorbedNFTs;

  const mergeTimesPersist = nftPersist.mergeTimes;
  mergeTimesPersist.push(event.block.timestamp.toI32());
  nftPersist.mergeTimes = mergeTimesPersist;

  // mergeCount, mass, color, tier of nftPersist
  nftPersist.mergeCount++;
  nftPersist.mass = (updatedValue % CLASS_MULTIPLIER) as BigInt;
  const bigIntTier: BigInt = updatedValue / CLASS_MULTIPLIER;
  const tier: string = checkMergeClass(bigIntTier);
  nftPersist.tier = tier;
  const alphaCheck = nftPersist.isAlpha;
  nftPersist.color = checkColor(tier, alphaCheck);

  const collection = Collection.load(MERGE_EXTADDR) as Collection; // NEW for collection entity
  const scenario = "Merge"; // NEW for collection entity

  updateCollection(nftBurned.id, scenario); // NEW for collection entity

  // TODO: call function updateMassTotal(tokenId)
  nftBurned.save();
  nftPersist.save();
  collection.save(); // NEW for collection entity

  // TODO: when decodeValue() works, may have to tweak as I haven't looked at it in a bit.

  // nftPersist.mass = decodeValue(
  //   updatedValue
  // ).mass;
  // nftPersist.color = decodeValue(updatedValue).color;
  // nftPersist.tier = decodeValue(updatedValue).tier;

  // TODO: FYI: only other time MassUpdate happens is when _burnNoEmitTransfer happens, I realize now that I need to make sure this accounts for that, but I do not think I have seen the function called tbh in etherscan / don't understand when it would get called.
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
 */
function updateNFT(tokenId: string, userId: string): NFT {
  const nft = NFT.load(tokenId) as NFT;
  nft.owner = userId;
  return nft;
}

/**
 * @notice create new NFT entity types upon mint
 * @param event: Transfer from handleTransfer() caller function
 * @dev key thing is the nftValue variable that is the encoded value metric used within the smart contracts to encode the mass and class data for each nft
 */
export function createNFT(event: Transfer, userId: string): NFT {
  const tokenIdString = event.params.tokenId.toString();
  const tokenId = event.params.tokenId;
  const nft = new NFT(tokenIdString);
  const contract = Merge.bind(event.address);
  nft.owner = userId;

  const nftValue = contract.getValueOf(tokenId);

  // obtain nft fields throughs calculating off of encoded value
  nft.value = nftValue;
  nft.mass = (nftValue % CLASS_MULTIPLIER) as BigInt;
  const bigIntTier: BigInt = nftValue / CLASS_MULTIPLIER;
  const tier: string = checkMergeClass(bigIntTier);
  nft.tier = tier;
  nft.isAlpha = false;
  const alphaCheck = nft.isAlpha;
  nft.color = checkColor(tier, alphaCheck);

  nft.mergeCount = 0;

  return nft;
}

/**
 * @notice totals the mass 'specific' details for the collection
 * @param
 * @dev takes care of totalMass
 */

/**
 * @notice initializes collection data
 * @param extAddr hexstring of ext address of contract
 * @returns newly initialized collection entity
 * @dev most fields left out bc they are handled further along within the first mint() [emitted Transfer] function.
 * @dev NEW for collection entity
 */
function createCollection(extAddr: string): Collection {
  const collection = new Collection(extAddr);

  // assign constants for collection

  collection.name = MERGE_NAME;
  collection.tokenStandard = TOKENSTANDARD;
  return collection;
}

/**
 * @notice increment or decrement merge. collection entity
 * @param trigger signals increment or decrement for collection mergeNFTsATM, totalBurns, totalMass, totalUniqueOwners, and possibly tierTotals.
 * @dev NEW for collection entity
 */
function updateCollection(tokenId: string, scenario: string): Collection {
  const collection = Collection.load(MERGE_EXTADDR) as Collection;
  const nft = NFT.load(tokenId) as NFT;
  const tier = nft.tier;

  if (scenario == "normTransfer") {
    return collection;
  }

  if (scenario == "Mint") {
    // update NFT count in beginning of merge collection
    collection.initialNFTTotal++;
    collection.mergeNFTsATM++;

    // TODO: not sure if I have to initialize these or not. If I do, then I just need to assign `originalMass` and `totalMass` it to zero in `createCollection()`
    collection.originalMass = collection.originalMass.plus(nft.mass); // NEW
    collection.totalMass = collection.totalMass.plus(nft.mass);
  } else if (scenario == "NonNiftyBurn") {
    //increments or decrements tierTotal based on scenario
    tallyTier(tier, scenario);
    tallyBurnDetails(tokenId, scenario);
    collection.totalUniqueOwnerAddresses--;
  } else if (scenario == "NiftyBurn") {
    tallyTier(tier, scenario);
    tallyBurnDetails(tokenId, scenario);
    // TODO: edge case, if there are no longer any NFTs within NG ownership.
    // TODO: last two if statements seem repetitive.
  } else if (scenario == "Merge") {
    // must be a merge scenario.
    collection.totalMerges++;
  } else if (scenario == "Alpha") {
    collection.alphaTokenId = tokenId; // new alpha
  }

  return collection;
}

// /**
//  * @notice increment or decrement merge. collection entity
//  * @param trigger signals increment or decrement for collection mergeNFTsATM, totalBurns, totalMass, totalUniqueOwners, and possibly tierTotals.
//  * 1. mergeNFTsATM: When mint() or burn() triggered, increment or decrement. PARAM:  'totalNFTDelta' which is an int based on mint(), burn()
//  * If Transfer(to=address(0)) in the updateNFT() function, then we increment totalBurns.
//  *
//  *
//  * 2. totalBurns: when Transfer 'to' - address(0), increment. param: address(to).
//  * 3. totalMass: when mint() triggered, increase totalMass by massSize minted. Decrease totalMass by massSize of tokenId that was burnt. So NFT.massSize will be passed into the function when either of these happens, call param 'totalMassDelta'
//  * @dev TODO: finish this once you have changed things to Ints.
//  * add a newUser boolean into TransferHandler, so that it triggers only when it is a new User.
//  */
// function updateCollectionTotals(totalNFTDelta: BigInt, totalMassDelta: BigInt, newUser: boolean): Collection {
//   let collection = Collection.load(MERGE_EXTADDR);

//   // if totalNFTDelta == 0, no change
//   // if totalNFTDelta == 1, increment counters, increase totalMass.
//   // if totalNFTDelta == 2, decrement counters, decrease totalMass.
//   // is there a scenario where we'd have a Transfer that didn't increase or decrease totalMass, totalNFTs, or totalBurn? a.) when users transfer nfts to other new users to the collection. This triggers changes on totalUniqueOwners*** b.) Transferring to whitelisted address... well transferring happens like this

//   /**
//    * transfer from address(0) to NG: mint()
//    * transfer from NG to new user: newUser boolean = true
//    * transfer from NG to pre-existing user: merge() will get triggered
//    * transfer from NG to address(0): this is a burn
//    * transfer to this contract is blacklisted
//    * transfer to address(dead) --> this is the same as transferring to pre-existing user. It ends up triggering transfer to address(0) anyways. OK, so pre-existing users, just have their NFT.owner, changed, and then massUpdate takes care of the eventual merge or burn.
//    * TODO: look into direct burns (send to dead, or send to address(0) directly) How would they do this? What does it effect?
//    * - [ ] Can they send directly to address(0)? SP: They can't actually, merge's implementation code doesn't allow it in _transfer(). So they can only burn through burn(), which just deletes the token details... it doesn't transfer anything to address(0), just emits an event saying it does.
//    * - [ ] The only way they can instigate burn without calling the burn function, is to send it to address(dead). That just calls _burnNoEmitTransfer(). OK. Hmm. So burns end up being shown as a Transfer Event where 'to' is address(0) as well. Nice. So merges, and burns both show as that. This means I can treat burn scenarios the same way as merges. Simply that when Transfer(x,address(0),tokenId) I can decrement the respective totals for NFTTotals, massTotals (and not decrement when massUpdate),
//    * - [ ] TODO: I might need a callHandler on burn() just to get the odd cases where someone does try to burn() using this function, and not just by sending to address(dead). THUS #ofBurns =
//    */

//   if (totalNFTDelta ==  ) {
//     // increment totals
//   } else {
//     // decrement totals
//   }
//   return collection;
// }

/* ========== TBD FUNCTIONS ========== */

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
