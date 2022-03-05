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

export function handleApproval(event: Approval): void {}

export function handleApprovalForAll(event: ApprovalForAll): void {}

export function handleConsecutiveTransfer(event: ConsecutiveTransfer): void {}

export function handleMassUpdate(event: MassUpdate): void {}

export function handleTransfer(event: Transfer): void {
  // when _safeMint() is called in base contract erc721, it emits transfer event where from is address(0). Try using this to load new NFTs and Users entities

  let user = User.load(event.transaction.to.toHex()); // from my understanding, if there is no User entity for this address, then we continue through the function logic.

  let from = event.transaction.from.toHex();
  // first, if `null` checks create new user entity if `from` was address(0)
  // TODO: look at ENS subgraph and study how they have implemented ethereum aspects such as EMPTYADDRESS within their mapping files as per: https://github.com/ensdomains/ens-subgraph/blob/master/src/utils.ts

  if (!user && from == Address(0)) {
  }
}
