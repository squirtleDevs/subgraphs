import { Address, BigInt } from "@graphprotocol/graph-ts";
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
import { EMPTY_ADDRESS } from "./utils";

/* ========== HELPER FUNCTIONS ========== */

// /**
//  * @notice sort color of nft based on massClass
//  * @param massClass corresponding to the enum Class from schema
//  * @returns Color: String
//  */
//  function checkColor(mergeClass: String): String {
//   let color: String;
//   if (mergeClass == "ONE") return (color = "WHITE");
//   if (mergeClass == "TWO") return (color = "YELLOW");
//   if (mergeClass == "THREE") return (color = "BLUE");
//   if (mergeClass == "FOUR") return (color = "RED");
// }

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
  let nft: NFT;

  let user = User.load(to);

  // check that user entity hasn't been create already
  // when nifty first mints first ever nft... they go through this.
  if (!user) {
    user = new User(to);
    // user.whitelist = false; //should be replaced by a callHandler later.
    nft = getNFT(event, user);
  } else if (
    // check that it is a mint tx, if so update user (nifty gateway omnibus likely)
    from == EMPTY_ADDRESS
  ) {
    // user.massNFT = [] TODO: not sure if this is needed
    nft = createNFT(event, user);
  }

  user.save();
}

/* ========== GENERAL FUNCTIONS ========== */

/**
 * @notice load NFT or call createNFT() for new NFT
 * @param event: Transfer from handleTransfer() caller
 * @returns
 */
function getNFT(event: Transfer, user: User): NFT {
  let tokenId = event.params.tokenId.toString();

  let nft = NFT.load(tokenId);

  // check that nft entity hasn't been create already
  // Step 1. so nifty walks through this first time ever. Essentially making a new NFT entity where owner is nifty gateway omnibus.
  // Scenario 2: new whitelisted address is allowed to mint (let's say there was one before minting was closed)... they would go through the same process as step 1.
  // Scenario 3: Exports from nifty, and transfers from other addresses now once minting is over. All nft entities should have been created before minting was closed / migration was allowed. So there is no scenario 3 for this if statement.
  if (!nft) {
    return (nft = createNFT(event, user));
  }

  // change ownership of nft assuming merge didn't happen right now. Subgraph rn doesn't catch merges so this is a big TODO:
  // TODO: if merge happened for this transfer event, then that nft owner should not be this user. So right now... I would think it shows migrations and thus other owners owning NFTs.
  nft.owner = user.id;
  // TODO: update nft fields for pre-existing nft! This would get complicated though cause it may update with massSize. For now, it's not in the scope of this PR cause I am just handling minting.

  //user.massNFT = [] //TODO: not sure if I will need this line, will find out when testing querying.

  //NiftyGateway NFT likely cause that is where I think the only minting happened
  nft.save();
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

  // nft.merged = false; //TODO: need to check this out because ppl bought more than one nft during mint in Nifty Gateway. This could have led to merging.
  nft.owner = user.id;
  nft.massSize = contract.massOf(tokenId);
  nft.massValue = contract.getValueOf(tokenId);
  nft.mergeClass = contract.decodeClass(nft.massValue).toString();
  // let alpha = contract._alphaId();

  // if (nft.mergeClass == "FOUR" && tokenId == alpha) {
  //   nft.color = "BLACK";
  // } else {
  //   nft.color = checkColor(nft.mergeClass);
  // }

  nft.mergeCount = contract.getMergeCount(tokenId); //only time it updates is when _merge() or batchSetMergeCountFromSnapshot() is called. The former is what is called post-mint-phase.

  // NOTE: transfer() is only called: 1. in merge() after _merge() is called 2. in _transfer() when to == _dead, two emits happen there. OR when transferring to another address AND/OR when token _merged into another tokenId (after transfer) --> thus taking care of the transfer event of sending a tokenId to address(0). Recall that _transfer() really  just ends up changing the record of ownership of the digital asset in the smart contract.

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

/**
 * @notice
 * @param event
 */
export function handleMassUpdate(event: MassUpdate): void {}

/**
 * @notice
 * @param event
 */
export function handleAlphaMassUpdate(event: AlphaMassUpdate): void {}

//  /**
//   * EVENTS to import as subgraph is iteratively developed: AlphaMassUpdate,
//   Approval,
//   ApprovalForAll,
//   ConsecutiveTransfer,
//   MassUpdate,
//   */
