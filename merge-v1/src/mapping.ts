import { Address, BigInt, log } from "@graphprotocol/graph-ts";
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
import { EMPTY_ADDRESS, CLASS_MULTIPLIER } from "./utils";

/* ========== GLOBAL VARIABLES ========== */

//TODO: not sure if we should have global variables?

// either store the alphaId and alphaMass size in a global variable somehow... or we have to handleAlphaMassUpdate() and take the tokenId that alphaMassUpdate gives us, and pass that to an NFT entity.
// NFT entity takes in the tokenId and updates boolean of whether it is Alpha or not. Prior to an AlphaMassUpdate() event, does Transfer() get called? I think it does.

/* ========== HELPER FUNCTIONS ========== */

/**
 * @notice sort color of nft based on massClass
 * @param massClass corresponding to the enum Class from schema
 * @returns Color: string
 */
function checkColor(mergeClass: string): string {
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
function checkMergeClass(_mergeClass: BigInt): string {
  let mergeClass: string;
  mergeClass = "ONE";
  if (_mergeClass == new BigInt(1)) {
    return mergeClass;
  } else if (_mergeClass == new BigInt(2)) {
    mergeClass = "TWO";
  } else if (_mergeClass == new BigInt(3)) {
    mergeClass = "THREE";
  } else if (_mergeClass == new BigInt(4)) {
    mergeClass = "FOUR";
  }

  return mergeClass;
}

/* ========== EVENT HANDLERS ========== */

/**
 * @notice handles Transfer events and ultimately instantiates / updates User and NFT entities
 * @param event: Transfer
 * NOTE: Checks through different scenarios (current WIP covers): 1. minting
 * TODO: 2. transfer from NG to ext. addresses, 3. transfers btw ext. addresses to other ext. addresses (not whitelisted), 4. merge() being called, 5. possibly merge being called by NG specifically.
 */
function handleTransfer(event: Transfer): void {
  let _to = event.params.to;
  let _from = event.params.from;

  let to = _to.toHex();
  let from = _from.toHex();
  let nft: NFT;

  let user = User.load(to);
  // let contract = Merge.bind(event.address);
  // let fromWhitelist = contract.isWhitelisted(_to);

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
  // } else if (from == to && fromWhiteList) {
  // }

  user.save();
}

// /**
//  *
//  * @param event
//  * @param user
//  * @returns
//  */
// export function handleAlphaMassUpdate(event: AlphaMassUpdate): void {
//   let alphaTokenId = event.params.tokenId;
//   let alphaMass = event.params.alphaMass;

//   // so basically, alpha updates only during mint() if tokenID != oldAlphaTokenID && during _merge().

//   // in the event of _merge(), there are a couple scenarios where this happens.
//   // merge(): when _transfer() is called, the actual ownership is done in the same tx. This is a key thing to start getting used to for subgraphs. When an event happens, unless the params have something to do with the tx at that literal point in time, then as long as the relevant variables are updated within the same tx of the event being emitted, we will be good!

//   // OK, I get the tokenId, then I call up load.nft(tokenId), and from there I update nft.isAlpha. The cool thing is that I won't have to check with the transferHandler() if tokens are alpha because this event takes care of it. If it did not take care of it, then I would have to figure out a way to compare what tokenId is the alpha and its associated values. I could do that through the generic entity for the collection. I don't have that set up yet though and since I have this event emission I'm good.

//   //within same tx, token owners and all that have been updated. Transfer() event will have been emitted.
//   let _alphaTokenId = alphaTokenId.toString();
//   let nft = NFT.load(_alphaTokenId);

//   // QUESTION for mint(): do subgraphs get the event data in the order that it happens within the smart contract logic? I ask this bc within mint() the Transfer() event happens before the AlphaMassUpdate() event. since it would be in the same tx, then I just want to know if I need to put logic here that checks if the nft exists or not. The only reason it wouldn't exist during mint() is if the Transfer() event didn't get digested first by the subgraph.
//   // 1. Transfer() emitted, then AlphaMassUpdate() emitted.

//   // for _merge(): Transfer(from, to, tokenId) emitted, _merge() then called so AlphaMassUpdate(_alphaId, combinedMass) and MassUpdate(tokenIdSmall, tokenIdLarge, combinedMass) emitted, then Transfer(to, address(0), deadTokenId) emitted, then that's it.
//   if (!nft) {
//   }
//   nft.massSize = alphaMass;

//   nft.isAlpha = true;
// }

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
 * @dev key thing is the nftValue variable that is the encoded value metric used within the smart contracts to encode the mass and class data for each nft
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

  let nftValue = contract.getValueOf(tokenId);

  // obtain nft fields throughs calculating off of encoded value
  log.info("nft value: {}", [nftValue.toString()]);
  log.info("class multiplier: {}", [CLASS_MULTIPLIER.toString()]);
  nft.massValue = nftValue;
  nft.massSize = (nftValue % CLASS_MULTIPLIER) as BigInt; //TODO: not sure why there are error lines. It builds fine.
  let fun: BigInt = nft.massSize as BigInt;
  log.info("mass size: {}", [fun.toString()]);

  let _mergeClass: BigInt = nftValue.div(CLASS_MULTIPLIER);

  nft.mergeClass = checkMergeClass(_mergeClass);
  log.info("merge class: {}", [nft.mergeClass as string]);

  let mergeClass: string = checkMergeClass(_mergeClass);

  // let alpha = contract._alphaId();

  // if (nft.mergeClass == "FOUR" && tokenId == alpha) {
  //   nft.color = "BLACK";
  // } else {
  nft.color = checkColor(mergeClass);
  // }

  // let mergeCount = 0; //only time mergeCount for an NFT updates is when _merge() or batchSetMergeCountFromSnapshot() is called. The former is what is called post-mint-phase.

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

// //  /**
// //   * EVENTS to import as subgraph is iteratively developed: AlphaMassUpdate,
// //   Approval,
// //   ApprovalForAll,
// //   ConsecutiveTransfer,
// //   MassUpdate,
