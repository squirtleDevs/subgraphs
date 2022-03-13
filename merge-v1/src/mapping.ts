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
    user = new User(to); // currently, the user is loaded, but if they do exist, they move along to user.save. Then that's it. What I want is for the handleTransfer event handler to
    nft = getNFT(event, user);
  } // checks if this is a mint() scenario
  else if (from == EMPTY_ADDRESS) {
    nft = createNFT(event, user);
  } // checks if this is a merge() scenario
  // I think we check if this is a merge. Recall that transfer(to==address(0)) happens when burn() is called, which is a weird scenario, and _transfer emits (to == address(0)) at the end of its tx logic, and deletes _owners[deadTokenId]. Somehow the txs I find on etherscan are actually calling burn(), which I'm still unsure of how but whatever. All mappins for the deadToken are 'deleted'

  // OK, so the smart contract prevents users from having more than one NFT, except for address(0) and nifty gateway.
  // SO that means we only get Transfer(to == address(0)) when burns or merges actually happen, and prior to this moment, NFT is temporarily sent to the merger account, but then redirected to address(0) soon after with another Transfer event.
  else if (to == EMPTY_ADDRESS) {
    nft = getNFT(event, user);
  } else {
    nft = getNFT(event, user); // TODO: I think I could actually replace this last call with `nft.owner = user.id;` but for the sake of keeping the nft-related implementation code in a separate function, I have decided not to for now.
  }

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

  nft.color = checkColor(mergeClass);

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
