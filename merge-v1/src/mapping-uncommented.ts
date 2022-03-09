import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
  Merge,
  AlphaMassUpdate,
  Approval,
  ApprovalForAll,
  ConsecutiveTransfer,
  MassUpdate,
  Transfer,
} from "../generated/Merge/Merge";
import { User, NFT, ExampleEntity, Color, Class } from "../generated/schema";
import { EMPTY_ADDRESS } from "./utils";

/* ========== HELPER FUNCTIONS ========== */

/**
 * @notice sort color of nft based on massClass
 * @param massClass corresponding to the enum Class from schema
 * @returns Color
 * TODO: running into type error and not sure how to make the return value a type, not a value here. Originally I was hoping to import enums from the schema, but that doesn't work. I think that makes sense though.
 */
function checkColor(massClass: String): String {
  let color: String;
  if (massClass == "ONE") return (color = "WHITE");
  if (massClass == "TWO") return (color = "YELLOW");
  if (massClass == "THREE") return (color = "BLUE");
  if (massClass == "FOUR") return (color = "RED");
}

/* ========== EVENT HANDLERS ========== */

/**
 * @notice handles Transfer events and ultimately instantiates / updates User and NFT entities
 * @param event: Transfer
 * NOTE: Checks through different scenarios (current WIP covers): 1. minting
 * TODO: 2. transfer from NG to ext. addresses, 3. transfers btw ext. addresses to other ext. addresses (not whitelisted), 4. merge() being called, 5. possibly merge being called by NG specifically.
 */
export function handleTransfer(event: Transfer): void {
  let to = event.params.to.toHex();
  let from = event.params.from.toHex();
  let tokenId = event.params.tokenId;
  let nft: NFT;

  let user = User.load(to);

  let contract = Merge.bind(event.address);

  // check that user entity hasn't been create already
  if (!user) {
    user = new User(to);
    user.whitelist = false;
    nft = getNFT(event, user);
  } else if (
    // check that it is a mint tx, if so update user (nifty gateway omnibus)
    from == EMPTY_ADDRESS
  ) {
    // user.massNFT = [] TODO: not sure if this is needed
    nft = createNFT(event, user);
  }
}

/* ========== GENERAL FUNCTIONS ========== */

/**
 * @notice load NFT or call createNFT() for new NFT
 * @param event: Transfer from handleTransfer() caller
 * @returns
 */
function getNFT(event: Transfer, user: User): NFT {
  let to = event.params.to.toHex();
  let from = event.params.from.toHex();
  let tokenId = event.params.tokenId.toString();

  let nft = NFT.load(tokenId);

  let contract = Merge.bind(event.address);

  // check that nft entity hasn't been create already
  if (!nft) {
    return (nft = createNFT(event, user));
  }

  nft.owner = user.id;
  // TODO: update nft fields for pre-existing nft! This would get complicated though cause it may update with massSize. For now, it's not in the scope of this PR cause I am just handling minting.

  //user.massNFT = [] //TODO: not sure if I will need this line, will find out when testing querying.

  //NiftyGateway NFT likely cause that is where I think the only minting happened

  return nft;
}

/**
 * @notice create new NFT entity types upon mint
 * @param event: Transfer from handleTransfer() caller function
 */
function createNFT(event: Transfer, user: User): NFT {
  let to = event.params.to.toHex();
  let from = event.params.from.toHex();
  let tokenIdString = event.params.tokenId.toString();
  let tokenId = event.params.tokenId;

  let nft = new NFT(tokenIdString);

  let contract = Merge.bind(event.address);

  nft.merged = false; //TODO: need to check this out because ppl bought more than one nft during mint in Nifty Gateway. This could have led to merging.
  nft.owner = user.id;
  nft.massSize = contract.massOf(tokenId);
  let value = contract.getValueOf(tokenId);
  nft.class = contract.decodeClass(value).toString();
  let alpha = contract._alphaId();

  if (nft.class == "FOUR" && tokenId == alpha) {
    nft.color = "BLACK";
  } else {
    nft.color = checkColor(nft.class);
  }

  nft.mergeCount = contract.getMergeCount(tokenId);

  nft.save();

  return nft;
}

/* ========== TBD FUNCTIONS ========== */

// /**
//  * @notice
//  * @param event
//  */
// export function handleApproval(event: Approval): void {}

// /**
//  * @notice
//  * @param event
//  */
// export function handleApprovalForAll(event: ApprovalForAll): void {}

// /**
//  * @notice
//  * @param event
//  */
// export function handleConsecutiveTransfer(event: ConsecutiveTransfer): void {}

// /**
//  * @notice
//  * @param event
//  */
// export function handleMassUpdate(event: MassUpdate): void {}
