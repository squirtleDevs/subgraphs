# CHEAT-SHEET (WIP)

This is a quick reference file for specific details with mapping creation and workflow / tricks, when creating subgraphs.

## Work Based on Merge Subgraph

1. Recall that Mappings are written in a subset of TypeScript called AssemblyScript. This can be compiled to WASM (WebAssembly). Mappings transform Ethereum data your mappings are sourcing into entities defined by your schema. NOTE: The schema outlines the 'type' that collections of entities fall under. Each instantiation of a unique IDed entity falls under a specific 'type' of entity.
2. For each event handler defined in subgraph manifest, create an exported function of the same name. Event handlers accept a single parameter called an `event` with a type corresponding to the name of the event. So in the case of `handleNewGravatar(event: NewGravatar)`, `NewGravatar` is the `event` parameter with the type `NewGravatar`.
3. When instantiating a new entity, `let <variable name> = new <EntityTypeName>(event:params.etc.())` <-- what this is doing is outlining what is going to be the `id` for that specific entity under that specific **entity type.**
4. Some recommended `id` values to consider (note `id` must be a `string`)
   - `event.params.id.toHex()` // is this the id of the event itself emitted on the blockchain?
   - `event.transaction.from.toHex()` // the from parameter within the tx.
   - `event.transaction.hash.toHex() + "-" + event.logIndex.toString()` //TODO: look these two aspects up!
5. Some key things from [Graph Typescript Library](https://github.com/graphprotocol/graph-ts):'

- ## Recall that this library contains utilities for interacting with the Graph Node store and conveniences for handling smart contract data and entities.

6. It seems that classes are the same as types. `yarn codegen` makes working with smart contracts, events, and entities easy and type-safe. It generates AseemblyScript types from the schema and the ABIs outlined in the manfiest data sources.

   - it generates an AssemblyScript class for every smart contract in the ABI files outlined in the manifest.
   - Binds these contracts to specific addresses in the mappings and call read-only contract methodss against the block being processed.
   - Generates a class for every contract event. This is so the parameters, and block and tx details are accessible for the event they originated from.
     - NOTE: these classes are then referred to as types and you import these types into the mappings.
       - TODO: Recall what classes are in JavaScript-esque languages vs Types in typescript or AssemblyScript.
   - A class is generated for each entity type in the schema too. They provide type-safe entity loading, read and write access to entity fields, and `save()` method to write entities to store. These classes are found in the `schema.ts` file and are to be imported into the mappings.
     > NOTE: `yarn codegen` code generation must be performed after every change to GraphQL schema or the ABIS in the manifest. It must be performed at least once before building or deploying the subgraph.
   - Use `yarn build` to check your mapping code for syntax errors that the TypeScript compiler may find.

7. Call Handlers: Many contracts avoid generating logs to optimize gas costs. TODO: look up logs that contracts can create. Read up on them.

   - Subgraphs can subscribe to calls to data source contracts.
   - Define call handlers referencing function signatures, and then the mapping handler will process calls to this function.
   - Mapping handler receives an `ethereum.Call` as an argument with the `typed` inputs and outputs from the call.
   - Calls at any depth in a tx call chain will trigger the mapping.
     > Call handlers only trigger in either case: when function specified is called by an account other than the contract itself, or when it is marked as external in Solidity and called as part of another functino in the same contract. TODO: not sure how the latter part of this would happen. Just confused a bit.
     ```yaml
     callHandlers:
       - function: createGravatar(string,string)
         handler: handleCreateGravatar
     ```
     - The `handler` is the name of the function in your mapping you would like to execute when the target function is called in the data source contract.

8. AssemblyScript APIs
   - The Graph outlines built-in APIs that can be used when writing subgraph mappings. Two of which include:
     - the Graph TypeScript library (graph-ts) and
     - code generated from subgraph files by `graph codgen`
   - Other libraries can be added as dependences as long as they are compatible with AssemblyScript.

- APIs, as mentioned in the form of the graph-ts and generated files from `graph codegen`, actually convert Ethereum types to built-in types behind the scenes. They do this with the generated clases for all smart contracts and events used in the subgraph (defined in the abis/).
- Therefore, values obtained when querying subgraphs are in the form of the built-in types. Let's say we want a BigInt! that corresponds with a uint256 value from an event parameter. Well, we'd have to work with it as a BigInt then, since that is the class (type?) that is associated to that field. Converting to specific types (uint8, BigInt, BigDecimal) is an important aspect to get right when working with mappings. One has to think about how the user will be querying as well and what format would be most helpful for the user. From there, one also has to be aware of how the event and smart contract data is being converted (what built-in types are thye being converted to from the ethereum raw data).

9. Most work done within mapping will be done via use of eventHandlers. DK outlined that he only used callHandlers once or twice in his time making subgraphs.

## Big Questions

1. How to handle Ethereum data. HexStrings, etc. Do I run into issues such as BigNumbers and whatnot similar to EthersJS? // Answer: check out the APIs for AssemblyScript laid out by the [graph](https://thegraph.com/docs/en/developer/assemblyscript-api/)

2. Importing entities from schema, when doing this, the mapping files actually treat it as a new class within the code of the subgraph. So entities are different classes.

3. The Graph docs outline how a callHandler is only triggered when:
   - Function is called by an account that isn't the contract itself, or
   - `external` function is called by the contract itself.
   - ANSWER as per convo with DK: This likely is a type where `external` is meant to say `public` because smart contracts, unless using `this.f()` pattern, cannot call external contracts within itself. The likely intent of the sentences here is that callHandlers are also triggered by functions within the contract itself that wrap around a `public` function of interest.
