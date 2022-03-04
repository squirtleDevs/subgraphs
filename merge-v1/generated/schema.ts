// THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.

import {
  TypedMap,
  Entity,
  Value,
  ValueKind,
  store,
  Bytes,
  BigInt,
  BigDecimal
} from "@graphprotocol/graph-ts";

export class User extends Entity {
  constructor(id: string) {
    super();
    this.set("id", Value.fromString(id));

    this.set("tokenID", Value.fromBigInt(BigInt.zero()));
    this.set("massSize", Value.fromBigInt(BigInt.zero()));
    this.set("color", Value.fromString(""));
    this.set("class", Value.fromString(""));
    this.set("mergeCount", Value.fromBigInt(BigInt.zero()));
    this.set("whitelist", Value.fromBoolean(false));
  }

  save(): void {
    let id = this.get("id");
    assert(id != null, "Cannot save User entity without an ID");
    if (id) {
      assert(
        id.kind == ValueKind.STRING,
        "Cannot save User entity with non-string ID. " +
          'Considering using .toHex() to convert the "id" to a string.'
      );
      store.set("User", id.toString(), this);
    }
  }

  static load(id: string): User | null {
    return changetype<User | null>(store.get("User", id));
  }

  get id(): string {
    let value = this.get("id");
    return value!.toString();
  }

  set id(value: string) {
    this.set("id", Value.fromString(value));
  }

  get tokenID(): BigInt {
    let value = this.get("tokenID");
    return value!.toBigInt();
  }

  set tokenID(value: BigInt) {
    this.set("tokenID", Value.fromBigInt(value));
  }

  get massSize(): BigInt {
    let value = this.get("massSize");
    return value!.toBigInt();
  }

  set massSize(value: BigInt) {
    this.set("massSize", Value.fromBigInt(value));
  }

  get color(): string {
    let value = this.get("color");
    return value!.toString();
  }

  set color(value: string) {
    this.set("color", Value.fromString(value));
  }

  get class(): string {
    let value = this.get("class");
    return value!.toString();
  }

  set class(value: string) {
    this.set("class", Value.fromString(value));
  }

  get mergeCount(): BigInt {
    let value = this.get("mergeCount");
    return value!.toBigInt();
  }

  set mergeCount(value: BigInt) {
    this.set("mergeCount", Value.fromBigInt(value));
  }

  get whitelist(): boolean {
    let value = this.get("whitelist");
    return value!.toBoolean();
  }

  set whitelist(value: boolean) {
    this.set("whitelist", Value.fromBoolean(value));
  }
}
