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
import { User, NFT } from "../generated/schema";
import { EMPTY_ADDRESS, CLASS_MULTIPLIER, NG_OMNIBUS } from "./utils";

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

  // Step 0 && Step 1: set NG_OMNIBUS as a whitelisted address as it is done in the constructor, and initialize new users
  if (!user) {
    user = new User(to);
    if (NG_OMNIBUS) {
      user.whitelist = true;
    }
  }

  user.save();

  let nft: NFT;

  // Step 2a: either create new NFT if in minting phase
  if (from == EMPTY_ADDRESS && to == NG_OMNIBUS) {
    nft = createNFT(event, user.id);
  } else {
    // Step 2b: OR updateNFT for all other Transfer scenarios incl: temporary transfers right before merging/burning, simple burning (direct to dead address, which then transfers to address(0))
    nft = updateNFT(tokenId, user.id);
  }

  nft.save();
}

/**
 * @notice updates when new alphaMass identified
 * @param event AlphaMassUpdate
 * @dev TODO: need to handle the old alphaMass still. So if one tokenId is alpha one day, but the next a different one is, they will both have the 'isAlpha' field as 'true'
 */
export function handleAlphaMassUpdate(event: AlphaMassUpdate): void {
  const alphaTokenId = event.params.tokenId.toString();
  const nft = NFT.load(alphaTokenId) as NFT;

  nft.mass = event.params.alphaMass;
  nft.isAlpha = true;
  nft.color = checkColor(nft.value.toString(), nft.isAlpha);

  nft.save();
}

/**
 * @notice
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

  nftBurned.save();
  nftPersist.save();

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

  nft.absorbedNFTs.push("n/a");
  nft.mergeTimes.push(0);

  return nft;
}

/* ========== TBD FUNCTIONS ========== */

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
