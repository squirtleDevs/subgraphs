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
import { User, NFTs, ExampleEntity, Color, Class } from "../generated/schema";
import { EMPTY_ADDRESS } from "./utils";

/**
 * NOTE: Either sorts through the possible times event Transfer() is emitted, or handles one scenario at a time.
 * Referencing ens subgraph architecture, I will have a function that creates newUser and newNFT entities. These functions will be called upon depending on different scenarios.
 * So I will have _handleTransferMint() that populates new Users, and new NFTs as they are minted (this should all be around the beginning block for the project).
 * There shouldn't be any more mints after that but you never know (well I could check the smart contracts, but yeah). So I could either have this setup, or have a handleMintTransfer() function that has logic in it checking if 'from' is address(0).
 * User fields should be good to populate: id, tokenId, massNFTs (where I check if the entity id for the corresponding NFT entity is null. If it is, create a new NFT entity type and fill out the fields accordingly.)
 * That should handle when mint() is called!
 *
 * NOTE: In general, individual scenarios will be outlined one by one in separate functions.
 *
 */

// Helper functions: these are smaller functions that I'll use for logic.

/**
 * TODO: Do called functions inherit the scope of the caller function (and thus the event details in this case and all that). Going to assume no, searching quickly kind of got confusing.
 * @param massClass corresponding to the enum Class from schema
 * @returns
 */
function checkColor(massClass: String): Color {
  if (massClass == "ONE") return "WHITE";
  if (massClass == "TWO") return "YELLOW";
  if (massClass == "THREE") return "BLUE";
  if (massClass == "FOUR") return "RED";
}

/**
 * @notice instantiates User and NFTs entities when minting carried out with Nifty Gateway
 */
export function handleTransfer(event: Transfer): void {
  let to = event.params.to.toHex();
  let user = User.load(to);
  let from = event.params.from.toHex();
  let tokenId = event.params.tokenId;

  let contract = Merge.bind(event.address);
  let newNFT: NFTs;

  // check that user entity hasn't been create already
  if (!user) {
    user = new User(to);
    user.whitelist = false;
    // TODO: not sure if I should load NFTs here for this or not...
  } else if (
    // check that it is a mint tx, if so update user (nifty gateway omnibus)
    from == EMPTY_ADDRESS
  ) {
    // user.massNFTs = []

    //NiftyGateway NFT likely cause that is where I think the only minting happened
    newNFT = createNFT(event.params.tokenId.toString(), user);
  }

  // ** NFT DETAILS ** //
  // TODO: Not sure if I should pass NFT details through above if/else above to createNFT(), or if I can populate the newly created NFT within the handleTransfer function here aftewards. I could change the required fields accordingly to what would be best.
  newNFT.massSize = contract.massOf(tokenId);
  let value = contract.getValueOf(tokenId);
  newNFT.class = contract.decodeClass(value).toString(); // TODO: not sure if I should leave it as string, or leave as BigInt. Figure it out as you make queries. Converted to string to use enums in schema for Class.
  let alpha = contract._alphaId();

  if (newNFT.class == "FOUR" && tokenId == alpha) {
    newNFT.color = "BLACK";
  } else {
    newNFT.color = checkColor(newNFT.Class);
  }

  newNFT.mergeCount = contract.getMergeCount(tokenId);
}

/**
 * @notice create new NFT entity types upon mint
 * @param tokenId
 */
function createNFT(tokenId: string, owner: string): NFTs {
  let nft = new NFTs(tokenId);

  //See TODO: regarding ** NFT DETAILS ** in handleTransfer() function
  nft.merged = false; //TODO: need to check this out because ppl bought more than one nft during mint in Nifty Gateway. This could have led to merging.
  nft.owner = owner;
  nft.massSize = todoMASS; //how do I get this if no event provides info.
  nft.color = todoCOLOR; // same question as massSize
  nft.class = todoCLASS; // same question as massSize
  nft.mergeCount = todoMERGECOUNT; // same question as massSize

  return nft;
}

/**
 *
 * @param event
 */
export function handleApproval(event: Approval): void {}

export function handleApprovalForAll(event: ApprovalForAll): void {}

export function handleConsecutiveTransfer(event: ConsecutiveTransfer): void {}

export function handleMassUpdate(event: MassUpdate): void {}
/**
 * @notice this is just an example function.
 */
export function handleAlphaMassUpdate(event: AlphaMassUpdate): void {
  // Entities can be loaded from the store using a string ID; this ID
  // needs to be unique across all entities of the same type
  let entity = ExampleEntity.load(event.transaction.from.toHex());

  // Entities only exist after they have been saved to the store;
  // `null` checks allow to create entities on demand
  if (!entity) {
    entity = new ExampleEntity(event.transaction.from.toHex());

    // Entity fields can be set using simple assignments
    entity.count = BigInt.fromI32(0);
  }

  // BigInt and BigDecimal math are supported
  entity.count = entity.count + BigInt.fromI32(1);

  // Entity fields can be set based on event parameters
  entity.tokenId = event.params.tokenId;
  entity.alphaMass = event.params.alphaMass;

  // Entities can be written to the store with `.save()`
  entity.save();

  // Note: If a handler doesn't require existing field values, it is faster
  // _not_ to load the entity from the store. Instead, create it fresh with
  // `new Entity(...)`, set the fields that should be updated and save the
  // entity back to the store. Fields that were not set or unset remain
  // unchanged, allowing for partial updates to be applied.

  // It is also possible to access smart contracts from mappings. For
  // example, the contract that has emitted the event can be connected to
  // with:
  //
  // let contract = Contract.bind(event.address)
  //
  // The following functions can then be called on this contract to access
  // state variables and other data:
  //
  // None
}
