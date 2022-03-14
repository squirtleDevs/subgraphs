import { Address, BigInt, log } from "@graphprotocol/graph-ts";
import { bigInt } from "@graphprotocol/graph-ts/common/numbers";
import {
  Merge,
  Transfer,
  AlphaMassUpdate,
  Approval,
  ApprovalForAll,
  ConsecutiveTransfer,
  MassUpdate,
} from "../generated/Merge/Merge";
import { User, NFT } from "../generated/schema";
import { EMPTY_ADDRESS, CLASS_MULTIPLIER, NOT_WHITE_VALUE } from "./utils";

/* ========== HELPER FUNCTIONS ========== */

/**
 * @notice sort color of nft based on massClass
 * @param massClass corresponding to the enum Class from schema
 * @returns Color: string
 */
export function checkColor(mergeClass: string): string {
  let color: string;
  color = "WHITE";
  if (mergeClass == "ONE") {
    return color;
  } else if (mergeClass == "TWO") {
    color = "YELLOW";
  } else if (mergeClass == "THREE") {
    color = "BLUE";
  } else if (mergeClass == "FOUR") {
    color = "RED";
  }
  return color;
}

/**
 * @notice sort mergeClass as a string to fit schema enum reqs
 * @param _mergeClass
 * @returns mergeClass: string
 */
export function checkMergeClass(_mergeClass: BigInt): string {
  let mergeClass: string;
  mergeClass = "ONE";
  if (_mergeClass == BigInt.fromI32(1)) {
    return mergeClass;
  } else if (_mergeClass == BigInt.fromI32(2)) {
    mergeClass = "TWO";
  } else if (_mergeClass == BigInt.fromI32(3)) {
    mergeClass = "THREE";
  } else if (_mergeClass == BigInt.fromI32(4)) {
    mergeClass = "FOUR";
  }

  return mergeClass;
}

// /**
//  * @notice object type where properties represent value-based-decoded nft metadata
//  * TODO: not sure but I am getting a compile error here. Asked DK. I need to just look into this. This will be done in next PR as I clean up the code.
//  */
// type Values = {
//   massSize: BigInt;
//   mergeClass: string;
//   color: string;
// };

// /**
//  * @notice carries out decoding of value for a particular mass NFT
//  * @returns value : Values
//  * @dev TODO: see Object Type Values above and the error that is there. Once that is resolved then this can be used.
//  */
// export function decodeValue(nftValue: BigInt): Values {
//   let value: Values;
//   let _mergeClass: BigInt = nftValue / CLASS_MULTIPLIER;
//   let mergeClass = checkMergeClass(_mergeClass);

//   value = {
//     massSize: (nftValue % CLASS_MULTIPLIER) as BigInt,
//     mergeClass: mergeClass,
//     color: checkColor(mergeClass),
//   };

//   return value;
// }

/* ========== EVENT HANDLERS ========== */

/**
 * @notice handles Transfer events and ultimately instantiates / updates User and NFT entities
 * @param event: Transfer
 */
export function handleTransfer(event: Transfer): void {
  let _to = event.params.to;
  let _from = event.params.from;

  let to = _to.toHex();
  let from = _from.toHex();
  let nft: NFT;

  let user = User.load(to);
  let tokenId = event.params.tokenId.toString();

  // checks if this is a new user
  if (!user) {
    user = new User(to);
    nft = getNFT(event, user);
  } // checks if this is a mint() scenario
  else if (from == EMPTY_ADDRESS) {
    nft = createNFT(event, user);
  }

  // all other Transfer scenarios incl: temporary transfers right before merging/burning, simple burning (direct to dead address, which then transfers to address(0))
  else {
    nft = getNFT(event, user);
  }

  user.save();
}

/**
 * @notice updates when new alphaMass identified
 * @param event AlphaMassUpdate
 * @dev TODO: need to handle the old alphaMass still. So if one tokenId is alpha one day, but the next a different one is, they will both have the 'isAlpha' field as 'true'
 */
export function handleAlphaMassUpdate(event: AlphaMassUpdate): void {
  let alphaTokenId = event.params.tokenId;
  let alphaMass = event.params.alphaMass;

  let _alphaTokenId = alphaTokenId.toString();
  let nft = NFT.load(_alphaTokenId) as NFT;

  nft.massSize = alphaMass;
  nft.isAlpha = true;

  nft.save();
}

/**
 * @notice
 * @param event MassUpdate
 * @dev TODO: fix decodeValues()
 */
export function handleMassUpdate(event: MassUpdate): void {
  let tokenIdBurned = event.params.tokenIdBurned.toString();
  let tokenIdPersist = event.params.tokenIdPersist.toString();
  let combinedMass = event.params.mass.toString();

  let nftBurned = NFT.load(tokenIdBurned) as NFT;
  let nftPersist = NFT.load(tokenIdPersist) as NFT;
  let updatedValue = nftBurned.massSize.plus(nftPersist.massValue);

  nftPersist.massValue = updatedValue;
  nftBurned.mergedInto = tokenIdPersist;

  let _absorbedNFTs = nftPersist.absorbedNFTs;
  _absorbedNFTs.push(tokenIdBurned);
  nftPersist.absorbedNFTs = _absorbedNFTs;

  let _timestampsPersist = nftPersist.timeStamp;
  _timestampsPersist.push(event.block.timestamp);
  nftPersist.timeStamp = _timestampsPersist;

  // mergeCount, massSize, color, mergeClass of nftPersist
  nftPersist.mergeCount++;
  nftPersist.massSize = (updatedValue % CLASS_MULTIPLIER) as BigInt;
  let _mergeClass: BigInt = updatedValue / CLASS_MULTIPLIER;
  let mergeClass: string = checkMergeClass(_mergeClass);
  nftPersist.mergeClass = mergeClass;
  nftPersist.color = checkColor(mergeClass);

  nftBurned.save();
  nftPersist.save();

  // TODO: when decodeValue() works, may have to tweak as I haven't looked at it in a bit.

  // nftPersist.massSize = decodeValue(
  //   updatedValue
  // ).massSize;
  // nftPersist.color = decodeValue(updatedValue).color;
  // nftPersist.mergeClass = decodeValue(updatedValue).mergeClass;

  // TODO: FYI: only other time MassUpdate happens is when _burnNoEmitTransfer happens, I realize now that I need to make sure this accounts for that, but I do not think I have seen the function called tbh in etherscan / don't understand when it would get called.
}

/* ========== GENERAL FUNCTIONS ========== */

/**
 * @notice load NFT or call createNFT() for new NFT
 * @param event: Transfer from handleTransfer() caller
 * @returns NFT with updated owner, or newly minted NFT entity
 */
export function getNFT(event: Transfer, user: User): NFT {
  let tokenId = event.params.tokenId.toString();
  let to = event.params.to.toHex();

  let nft = NFT.load(tokenId);
  if (!nft) {
    nft = createNFT(event, user);
    return nft;
  } else if (to == EMPTY_ADDRESS) {
    nft.merged = true;
    nft.owner = EMPTY_ADDRESS;
  }
  nft.owner = user.id;
  nft.save();
  return nft;
}

/**
 * @notice create new NFT entity types upon mint
 * @param event: Transfer from handleTransfer() caller function
 * @dev key thing is the nftValue variable that is the encoded value metric used within the smart contracts to encode the mass and class data for each nft
 */
export function createNFT(event: Transfer, user: User): NFT {
  let to = event.params.to.toHex();
  let from = event.params.from.toHex();
  let tokenIdString = event.params.tokenId.toString();
  let tokenId = event.params.tokenId;

  let nft = new NFT(tokenIdString);

  let contract = Merge.bind(event.address);

  nft.owner = user.id;

  let nftValue = contract.getValueOf(tokenId);

  // obtain nft fields throughs calculating off of encoded value
  if (nftValue >= NOT_WHITE_VALUE) {
    log.info("nft value: {}", [nftValue.toString()]);
  }
  nft.massValue = nftValue;
  nft.massSize = (nftValue % CLASS_MULTIPLIER) as BigInt;
  let fun: BigInt = nft.massSize as BigInt;
  let _mergeClass: BigInt = nftValue / CLASS_MULTIPLIER;
  let mergeClass: string = checkMergeClass(_mergeClass);
  nft.mergeClass = mergeClass;
  nft.color = checkColor(mergeClass);

  nft.mergeCount = 0;

  nft.absorbedNFTs.push("n/a");
  nft.timeStamp.push(BigInt.fromI32(0));
  nft.save();

  return nft;
}

/* ========== TBD FUNCTIONS ========== */

/**
 * @notice
 * @param event
 */
export function handleApproval(event: Approval): void {}

/**
 * @notice
 * @param event
 */
export function handleApprovalForAll(event: ApprovalForAll): void {}

/**
 * @notice
 * @param event
 */
export function handleConsecutiveTransfer(event: ConsecutiveTransfer): void {}
