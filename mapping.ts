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

export function _handleTransferMint(event: Transfer): void {
  let user = new User(event.params.to.toHexString());
  user.save();
}

/**
 * So when else is Transfer() event emitted?
 * From ERC721.sol: safeMint(), burn()
 * From merge.sol: merge(), _transfer() except there are different scenarios within the fn that call transfer
 *
 * When AlphaMassUpdate() happens: during _merge() if combinedMass > current _alphaMass, and during mint() which is a special NiftyGateway function pretty much. NOTE that mint() can only be called when minting is not finalized. So it is done!
 *
 * When MassUpdate() happens: 1.) _merge() when a merge actually happens., 2.) when a _burnNoEmitTransfer() happens.
 *
 * What is a _burnNoEmitTransfer(): Looks like it is just the internal burn implementation code. It is only called when burn() OR transferFrom() is called with _dead as the 'to' address. I'm not sure when _dead is used as the 'to' address... I guess that is when merge becomes burnable.
 *
 * Approval(owner, to, tokenId): triggered when _approve() internal called --> called when approve public is called, AND when _burnNoEmitTransfer() is called.
 *
 * ApproveForAll(): triggered when setApprovalForAll() public called -->
 *
 * OK, so now I understand the different times that these events are called. Naturally, creating the entities as per the chronological order of events emitted (and their respective scenarios) is an OK idea. So it would look like:
 *
 * - [ ] Create function for minting scenario (directly )
 * - [ ] Create function for
 *  - IMO, it seems that the backend of NiftyGateway handles purchases from users, then they keep track of who has what mass, from there, they hook into the logic of mint() in pak's contracts, where they are given a ton of NFTs (in merge contract records... but I don't see 'transfer' actually being called!). These NFTs are not via normal minting and transfering of NFTs though,
 * ---> OH SNAP. The NFTs are all minted to Nifty Gateway. From there Nifty Gateway can transfer them out to respective addresses (as per user's choice). Hmm. So when mint() is called by NiftyGateway, is the minting somehow taken care of by Nifty Gateway?
 *
 */

/**
 * @notice instantiates User entity when minting carried out with Nifty Gateway
 */
export function handleTransfer(event: Transfer): void {
  let user = User.load(event.transaction.to.toHex());
}

export function handleTransfer(event: Transfer): void {
  // when _safeMint() is called in base contract erc721, it emits transfer event where from is address(0). Try using this to load new NFTs and Users entities

  let user = User.load(event.params.to.toHex()); // from my understanding, if there is no User entity for this address, then we continue through the function logic.

  let from = event.transaction.from.toHex();
  // first, if `null` checks create new user entity if `from` was address(0)
  // TODO: look at ENS subgraph and study how they have implemented ethereum aspects such as EMPTYADDRESS within their mapping files as per: https://github.com/ensdomains/ens-subgraph/blob/master/src/utils.ts


  // check that user entity hasn't been create already
  if (!user){
    user = new User(event.transaction.to.toHex());
    

  } else if
  ( from == EMPTY_ADDRESS) {
    user = new User(event.transaction.)
  }
}

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
