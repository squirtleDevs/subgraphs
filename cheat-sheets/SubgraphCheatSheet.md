# CHEAT-SHEET (WIP)

This is a quick reference file for specific details with subgraph creation for myself (and whoever else is interested).

TODO: filter this doc for them and find answers to these questions.

---

## TODO: Quick CLI Commands and Workflow (WIP)

Go to the UI and create a new subgraph. This assumes you have the graph CLI globally installed on your local machine.

1. `graph init --product hosted-service <GITHUB_USER>/<SUBGRAPH NAME> --abi <fileLocation>.json` The `--abi` part and onward is only if you have any issues with the abi from etherscan. This one exhibited some oddities so we had to clean up the ABI.json file a bit.

2. `yarn codegen`

3. `graph auth --product hosted-service <ACCESS_TOKEN>`

Now you should have your subgraph syncing. Note you may need to have your startblock specified within your manifest.

## Subgraph Creation

Four main ingredients for subgraph creation:

1. Subgraph manifest (subgraph.yaml): This specifies the general details of the subgraph in question.
2. Subgraph schema (schema.graphQL): This specifies additional entities to be stored within the Graph store.
3. ABIs for the smart contracts involved.
4. mapping.ts: how you store the data into the schema. NOTE: this is the boilerplate mapping name, you'll likely have mapping<contractName>.ts and other mapping.ts files.

When one creates a new subgraph, the following happens to instantiate the subgraph with the above key components:

1. AssemblyScript is generated where classes are created for: the smart contract file(s) specified within the manifest. Binding of the smart contract ABIs and the contract addresses are made. This leads to the next class created: the event classes are created based off of the ABIs of the contracts specified. Read-only calls for methods are also exported into the AssemblyScript files. These files are all stored within a respective <contractFileName>.ts and then imported by `mapping.ts`
2. AssemblyScript classes are generated for the entities outlined within the schema. `mapping.ts` imports these classes into it as well.

## Subgraph Deployment

1. Specifying multiple data sources within the manifest: see this [link](https://github.com/ensdomains/ens-subgraph/blob/master/subgraph.yam) for reference.

## Subgraph Theory

## Current Day Subgraph Nuances

These will be updated in time as the Graph continuously improves, iterates, and innovates.

1. Currently only one data source can be specified when beginning a new subgraph. Manual additions of more data sources have to be done after the initialization of it.
2. Call handlers are not supported on Rinkeby, Goerli or Ganache. Call handlers currently depend on the Parity tracing API and these networks do not support it.
3. Initializing subgraph on hosted service they provide allows for testing of your subgraph before deployment onto decentralized network, or hosted service. <-- TODO: I may have this phrasing incorrect.
4. **Subgraphs published to Rinkeby can index and query data from either the Rinkeby network or Ethereum Mainnet.**

- This is interesting because I can test my subgraphs in testnet with mainnet queries though. TODO: You would want mainnet subgraph ultimately though to get more indexing to it since it would be part of the economics of the system then. No indexers really in testnet.

## References

1. [Graph Docs](https://thegraph.com/docs/en/developer/create-subgraph-hosted/)
