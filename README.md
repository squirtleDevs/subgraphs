# 🛰 Subgraphs

The intent of this repo is to document the creation of my first subgraphs, and possibly more.

---

## 🧑🏻‍🚀 Gravatar

This is the beginner tutorial for subgraphs. It is outlined within this video from ethGlobal: https://www.youtube.com/watch?v=coa0Vw47qNc&t=818s

---

## 👀 Figuring out First Custom Subgraph to Make

For the first Subgraph, I needed to think about how it would be used actually in the field. A front end would want to collect queries from the stored data that is in the Graph store. So visual charts could be made with queried data for example. The data would be queried everytime someone goes to the front end I guess, or loads the page that has the visual chart.

Okay, so for my subgraph, DK had suggested I look at a project I am familiar with:

1. Pak merge
2. x0r MEV Army
3. Orca protocol
4. Crytpogs

Alright, well I think I should walk through the thought process of each one until I find one that makes sense to create a subgraph for. If you want to see that, open below toggle.

<details markdown='1'><summary>Let's breakdown the perspectives one by one and the inherent data that would be required.
</summary>

1. Existing Investor's Point of View:

   - Owns a mass NFT. Connects wallet to front-end so the dApp can use their public address send queries to the Subgraph asking for information on the public address and if it owns NFTs in this collection. The query also asks for info of the owner's NFTs relative to all other mass NFTs on mainnet.
   - Traits seen include: NFT classes, number of merges that this NFT has gone through
   - Traits for rest of collection: Number of deleted mass NFTs (due to merging with others), number of mass NFTs still in existence in each size of mass.
   - Leaderboard

2. Marketplace Point of View:

   - All connected wallets and their respective NFTs
   - Last sold price (not sure if that is an internal metric on OpenSea though) --> even if it was, it's an onchain metric, payable ETH or whatever erc20 amount. I don't know if you can buy with ETH actually on OpenSea, I'm guessing you can.
   - Details of the NFT (the class and whatnot for the NFT... TODO: I'm not sure if this is on-chain or not).
   - From glancing at this [BAYC](https://opensea.mypinata.cloud/ipfs/QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/8372), I believe that the trait_type that OpenSea and other marketplaces want are to be stored in a JSON file like this. Then the marketplace parses that information and obtains what they need for the classes and trait types.
   - This is confirmed from looking at OpenSea's docs for how to set up [metadata](https://docs.opensea.io/docs/metadata-standards#:~:text=OpenSea%20supports%20the%20storage%20of,format%20ipfs%3A%2F%2F%20.).

When someone hits the API endpoint of this subgraph, they will get rich data that exposes all of these data points. From an architectural view though, if the data associated to either of these perspectives are large, we would need to consider creating two separate subgraphs so indexing and querying is faster. TODO: confirm this thought after pushing the subgraph (this one is small in ingestion so it won't matter).

   </details>

---

## ⭐️ First Subgraph Plan (merge)

I am going with the Pak merge project and creating a subgraph for it.

My instructions at the start were to think about what the useful data would be for the open sea front end, and extract that data from the contracts.

From glancing through OpenSea and the merge contracts:

1. [Opensea listings of merge collection](https://opensea.io/assets/m?search[sortAscending]=true&search[sortBy]=PRICE)
2. [merge contract on mainnet](https://etherscan.io/address/0xc3f8a0f5841abff777d3eefa5047e8d413a1c9ab#code) && [merge metadata contract on mainnet](https://etherscan.io/address/0x4e1e18aaccdf9acfd2e8847654a3871dfd234f02#code)

---

### ✅ What will mark this subgraph as complete:

- [ ] Published to Rinkeby, indexing and querying data from Eth Mainnet.
- [ ] Create schema that collects the information from the 'right' perspective (see notes).
- [ ] Create the mapping to properly store data in accordance to the schema.
  - [ ] _This is a true test of your contract knowledge_ Open up the smart contracts, and work through the mapping file to obtain the information you desire. NOTE: is it typical to have your subgraph start with boilerplate mapping.ts based off of the exampleEntity within the schema, your ABI, etc.? YES. From there you have to import the new generated Classes and work with them. // est: 1hr
  - [ ] Troubleshoot the subgraph with the mapping file you create. Do it one function at a time. A workflow will appear. // est: 1 hr
  - [ ] Update subgraph and test with queries. Do this for one 'chunk' of the data entities, and then once you're good with that do it for the rest // est: 1 hr
- [ ] Review with DK to see what parts could be improved. Do through PRs on github.

- [ ] Finish basic entity subgraphs in mapping:

### Handling User and NFT entities for mint() scenario

- [x] Add in whitelist for user entity
- [x] `User.whitelist` field will be handled with a call handler (when pak calls it). Have it be set as default `false`. Although NOTE that it should actually be `true` for the NG omnibus and other NG addresses. This would be captured with a callHandler() on `whitelistUpdate()`
- [x] Change `NFTs` entity to NFT
- [x] Move `NFT` updates to `createNFT()` instead of `handleTransfer()`. Do this by passing `event` type through to the callee function `createNFT()`
- [x] Make sure to save newly created entities or updated ones.
- [x] Clean up architecture to consider `getNFT()` vs `createNFT()`
- [x] Clean up the comments within the mapping file

- [x] Submit in-progress PR that is showing typescript errors.
- [x] Sort out plan for what parts to comment out and how to query them. Write out how you would query them. At least for the data you have so far.
- [x] Fix small bug that Dave found causing the compile error: field `class`, change it to `mergeClass`
- [x] run `yarn codegen` since you changed the schema
- [x] Comment out the code and run iterative subgraph deployments, test query them too.
- [/] Submit PR with finished subgraph draft for minting function for `merge.sol`
  - [ ] Make sure it works with specific queries. Show that you understand what kind of queries would be good.
    - [ ] specificNFTQuery: you look up an nft, you see its details. These need to reflect the current collection's status.
      - [ ] In order for that to happen: w/o past data... we just won't be able to see what mass NFTs have been merged. --> I'm going to try and see one test to see if I can get the boolean to show for merged. If that doesn't work, I can use the massUpdate event handler later to get the nft.merged field updated.
      - [ ] Show this with a merged NFTquery.
    - [ ] specificUserQuery: you look up a user, you see their details.

# 🚨🚨😎 Merge Subgraph Goals and Task Breakdowns

Deadlines are the internal ones I've laid out.

## [ ] Update 1 - Equivalent to a front end that would show live data of who owns what:

- Definition IMO: shows nfts reflecting status as per the merge contract (game). Handles scenarios of: transfering from one account to another (merge), from calling burn() which is a weird thing but somehow it happens [TODO: something I'm confused by in the smart contracts tbh], transfers within Nifty Gateway (whitelisted) and merges in their UI, mint() from whitelisted during minting time period.

  - [x] Get merged boolean field to update, and owner: id{} to update to address(0) when burnt (merged).
  - [x] Fix mergeClass. It is not changing the class as I want it to. Write logs for it.
    - Check logs. Go from there.
  - [x] Need to increment mergeCount, as I make MassUpdateEventHandler() and AlphaMassEventHandler()
    - [x] Test deploy it!
  - [x] Need to get timeStamp somehow for when merges happens. Maybe txHash and its timestamp, then convert it to UNIX somehow?
  - [x] Need to get whether or not the NFT isAlpha or not.
    - [x] Do the above by focusing on one at a time. Writing the implementation code, deploying the subgraph, seeing if it works. Make logs for it too as you get any errors to troubleshoot.]

### Query tests:

- [x] NFT specific query,

  - Token 7705: showing my own NFT [not-merged, class-one] // etherscan:
  - Token 385: recently merged, and burnt. // etherscan:
  - Token 1: Alpha // etherscan:
  - Token ??: RED // etherscan:
  - Token ??: YELLOW // etherscan:
  - Token ??: BLUE // etherscan:

- [/] NFT all entities (why is it showing tokenIDs in the 10s, 100s?)
- [/] All user entities
- [/] Top 100 mass entities
- [/] Top 100 mass entities, taking into account class.
- [/] Nifty Gateway address (omnibus that is whitelisted) to see how it has an array of tokenIDs (massNFTs)
- [/] Non-Whitelist examples showing how they only have one NFT associated to their name. Specifically key on an address that has a merge happen with them, and how the smartcontract and the subgraph keep track of this.
- [/] Address(0) and how it has a bunch of NFTs, all of which have merge boolean set to True.

## [ ] Update 2 - Make sure all metadata is being read // DUE: Tuesday or Wednesday this week

Shows pertinent metadata for OpenSea and other marketplaces.

- [x] Outline how OpenSea likes to obtain its information, pretty sure it is just a JSON file from a URI. BUT, it is different with on-chain SVG art. Check out how marketplaces deal with that. merge smartcontracts produce a JSON I think that these marketplaces can get the info they need from. So if our subgraph produces the JSON and/or URI within a field for the respective NFT, then that would be good. Right now, they can't do that, all they get is the metadata fields. So I would need to produce the image link, or something. As well, the metadata.sol file that merge inherits does contain all the metadata for certain NFTs. I don't think it emits events though, so I would have to bind to it to get the trait data. The way I go about it now is better. The thing is... what about the image? Can Opensea work with subgraphs also?
- [x] Write out notes on how to implement code. Pause for now until other updates are done as per discussion with DK on March 17.

## [ ] Update 3 - Totals and counts // DUE: THURSDAY this week

\*Recent assumptions:

- pak or NG passed array of values where the values were for each tokenId and included sorted values for the top 100 mass NFTs at that point in time. As per discussions with DK and investigating the smart contracts and talking with the urn and manifold discord servers, there is reason to believe that they didn't do alternatives such as:
  - use index-listed arrays. Something along the lines of having the ability to **efficiently** edit elements of the array where an element has two connected endpoints (the prior element and the one after).
- Colors are dicated by the value of a tokenId. That color is passed to the private function \_getSvg. There is no way for color to reoriented based on a mass breaking into the leaderboard (top 100 biggest masses). This seems to be valid hypothesis since there are white mass NFTs within the top 100, not just colors (yellow, red, blue, black).

> These assumptions don't really change anything for me. mergeNFTs change class, and their resultant colors change when merges happen. So that's all good! This assumption makes it so that these new aspects are all held at the constructor of the project.

- [ ] Collection totals

  - Update schema with these fields
  - Update mapping and iteratively deploy subgraph with them

  **Need to think about the design of the code**
  updateCollectionTotals(): Use a separate function and pass in parameters to get a return value for the collection, or save the collection within the function itself.

  > Good to see what others do, save the entity within a separate function or within the original function (eventHandler).

  - One can't send to address(0), they have to send to address(dead).
  - Otherwise burn() can be used to send an NFT to address(0). Transfer event is emitted where to = address(0). So burns act the same way as burns within \_transfer(). This is the only way to just archaically burn it.
    Cool, so I'll pass param to.address as a hexstring, and have IF statements within the updateCollectionTotals() looking for whether it is address(0) or not. If it is, then burn and decrement and increment certain things accordingly. If it isn't, then allow it to increment accordingly. Will have to check from.address too to make sure it is a mint. If it's two addresses, then increments do not change because the Transfer(address(0)) takes care of that.
  - MassUpdates trigger if we increase mergeCount.
  - tierUpdates happen when: minting, merging, burning. They work by knowing what tokenId was used and getting its tokenId and its subsequent metrics, and then updating them. We can update them when using TransferHandler. --> There are already conditions checking to & from addresses so I can use that and then have it determine what params to send.

  - [x] Write implementation code first, then mark lines to comment out with // NEW
  - [x] total mergeNFTs in existence
    - [x] count `noMergeBurns`
    - [ ] Address edge case of if there are no NFTs in Nifty Gateway ownership.
  - [x] original amount of mergeNFTs in the beginning (before merges began to happen)
  - [x] tier totals (yellow, blue, red, white, black)
    - NOTE: black is accounted for by knowing there is only one Alpha
  - [x] # of current owners --> # of tokenIds that are within whitelisted Addresses (Nifty Gateway OMNIBUS) will indicate how many owners there are
  - [x] # of merges that have occurred
  - [x] # of random anarchic burns that occurred (burn, no merge)
  - [x] Save a separate version for your own development of mapping, and then save a cleaner copy for PR Review.

## March 22 TODO

- [x] Finally have all PR3 changes in a new feature branch ready to be worked on.

  - [x] Review and fix any PR3 changes besides unit changes - 1.25 hr
  - [ ] Go through schema and pick out what should be an int and what should be a BigInt.
    - IMO, Ints should be the default if I can get it so that our mapping can work with it accordingly. The only time we go with BigInt is:
      - when I am dealing with values that >> 2^53
      - I think that's really it. Client-side can make my values BigInts if they want.
        **THUS `value` that is obtained from the blockchain is BigInt, and then converted to Int**
        > I will do this after working on making sure the implementation code for Update 3 makes sense. I don't want to do too many things in one commit.
    -
  - [ ] Go through mapping and fix in accordance to proper units wrt to schema
  - [ ] yarn codegen
  - [ ] fix as needed
  - [ ] deploy and assess results
  - [ ] fix as needed
  - [ ] Prepare PR3 for review:
    - clean up:
      - .gitignore
      - extra wip (take it out altogether)
      - remove the README.md too, it is too messy atm.
  - Submit PR3

- [ ] Finalize your numbers by double checking with etherscan, or some other trustworthy source (perhaps Nifty Gateway, or the merge front-ends)

## [ ] Update 4 - Historical data of who owned every nft // DUE: FRIDAY

Types of historical data that ppl may want:

- Maybe the leaderboard ranking at a certain point in time (I think ppl would just query that specifically specifying block timestamp or block number in their query).
- Who owned what NFT, and when? --> put it in an array and push elements to it where each element is a previous owner of that NFT.
  - This captures all transfer data essentially (now offering tx history for nft for frontend)
- Could add the mass value of the merge NFTs it absorbed BUT it is redeundant through the fact that clients can just get the mass Size of a prior abrorbed nft through the NFT fields itself for the aborbed token.
- What the NFT merged into, and when --> DONE
- What the NFT absorbed, and when --> DONE
- Sales (To be done in Update 5): when the NFT was sold, for how much, by who, to who, eth transaction hash of sale(s), on what platform. Client side would query by asking for a specific tokenId and all of its associated sales. You get this in the Sales entity.

## [ ] Update 5 - Prices in USD and ETH or all trades // DUE: FRIDAY

- If it is purchased with ether, the event Transfer will have msg.value attached to it <-- This is a good opportunity to ensure I understand what I can get out of the txs (at least a sample).
- If it is purchased with an erc20, I will likely have to have implemented marketplace datasources, of which I can add to (if new marketplaces spring up). These new datasources will allow me to handle events from OpenSea, LooksRare, etc. to get the actual token addresses of the erc20s and the amounts.
- That is enough for DK right now.

  > Don't worry about Nifty Gateway purchases as they have their own backend and essentially act in similar ways to Binance, being a rapid fast trading platform.

- [ ] Set up datasource (opensea for now) where you track events emitted for the merge collection specifically.
- [ ] Events emitted:

  - Transfer() is typically emitted with an erc20 token. OpenSea has their own basic ERC20 abstract contract acting as an interface. So the pay-token defined for the sale will have its own implementation code that will at the very least satisfy the method signature from the abstract contract here.
    - If we went this way...
  - `OrdersMatched()` is the only Opensea event emitted in the logs upon sale of an NFT. As per : https://etherscan.io/tx/0xa8d8e306a8c24c6922ff141d74dbe909c97c8ad3e614100b9ca8ed5a9b61e0f4#eventlog

    - It doesn't include the token address though so I only have the amount of whatever erc20 token was used.
    - I spent a good deal of time (3-4 hours) looking through the code to see if this information was emitted elsewhere. It is emitted in `OrderApprovedPartTwo()` event but this does not mean that this particular order has been fulfilled (when the approved event is emitted, it just means it's been approved).
    - Then I checked through the conditional logic a bit more and still could not piece together how I would get the tokenAddress.
      - Perhaps one lead is `... cancelledOrFinalized[buyHash] = true;` where I could get the approved `Orders` from `OrderApprovedPartTwo()` event emissions, and use `... cancelledOrFinalized[buyHash] = true;` to sort through finalized hashes... so it would check if it was `cancelledOrFinalized[]` and also check that the buyer or seller is involved with the respective `OrdersMatched` event emission.

  - **I am also confused if we can access the tx details or not. I do not think we can though. Sure, params can be accessed, but in general I think that one cannot just get all tx details that were part of an event, or call that is being handled.**

  - For context:
    - `atomicMatch()` is a public function that I believe is called as one does a sale (or at least is affiliated with sales). - From there, `uint price = executeFundsTransfer(buy, sell);` is implemented. - `executeFundsTransfer()` ends up calling `transferTokens()` - `transferTokens()` is an internal function that calls `require(tokenTransferProxy.transferFrom(token, from, to, amount));` effectively calling `return ERC20(token).transferFrom(from, to, amount);`
      SO, since a Transfer() Event is emitted

> Ended up writing some summary notes above for Update 5 work... and asked questions on "The Graph, Buidl Guidl, Opensea, and to Cosmo" about this.

## [ ] Nice to Have

- [ ] Change BigInts to Ints where I can to speed up syncing even a bit.

### Update as per discussion with DK - March 10th, 2022

Had a good half hour review with DK on the subgraph so far. This particular subgraph emits Transfer events probably the most out of the other event emissions throughout time. As such, carrying out contract calls can be very intensive when it comes to having the subgraph sync fully with the ethereum mainnet network.

Contract calling means that the subgraph is literally calling an ethereum node for information directly from the smart contract records. Although this is completely okay to do, it increase the syncing time substantially. This is not the best practice because iterative subgraph design and development requires constant tweaking and redployment in terms of the mapping and other subgraph files.

Therefore the following tasks will be done to design this subgraph in a faster syncing way, that ultimately will save time in development since I will not have to wait 2 hours+ to sync the subgraph to the mainnet network everytime I redeploy it with an upgrade.

- [ ] Extract the value data of each nft token when they are newly minted. Do this via connecting to the contract. This will bhe the only time hopefully that I connect to the contract (vs right now I currently have 4-5 times in my code that I call the contract). This should quicken the syncing by 3-5x.
- [ ] Use the value data and write out implementation code that decodes the mass, class, and whatever else information that may be available through obtaining the value of each token.
- [ ] Write the mapping so that it also sorts out which class will be merged when that edge case happens (a yellow being merged into a black for example).
- [ ] Once the subgraph is updated to sync much faster using these \_value details, then I can submit my PR.

Cool lessons learnt:

- Note about syncing
- ENUMs are good, even in my case of this subgraph, as where I use it, there really are only so many options. You would use a uint if you had boundless options.
- pure functions in solidity mean that no matter what, the return value will always be the same. Think of an example where your return value is the product of some input param and the block.timestamp. That would always change. That would not fall under a pure function.
  - the pure functions in the merge smart contract signal that we can actually feel confident in building out the logic in the subgraph for that respective function!

### After submitting PR

- [ ] Add a whitelist call handler
- [ ] Work through next scenario of transfer event handling.
- [x] Add a unix timestamp array field so front-end can easily grab the times that merge txs occurred.
- [ ] Add the following to the schema for NFT:

```
  # "tx hash - TODO: I think I did this wrong just gotta look it up"
  # blockHash: [Bytes] #pak
```

########

- [ ] Review the code and highlight questions to go over with Dave
- [ ] Try compiling it
- [/] Add in note about how if someone purchased another mass during the minting phase... then a merge may have happened but that's backend stuff too with Nifty Gateway... confusing.

- [ ] You can only use event handlers once. So... when an NFT is transferred, we need to take all scenarios into account.

---

### 🔎 Perspective of Subgraph

There are two perspectives for this Subgraph.

1. Existing and Potential Investors in the project interesting in the game metrics
2. NFT Marketplaces like OpenSea

---

### 📜 Working Notes on Creating the Mapping

The approach I took when coming up with the details of the mapping for this subgraph was:

1. Assess base-contracts (parent-contracts) inherited by Merge.sol, and the relevant emitted event and function calls.
2. Assess Merge.sol contract itself.

Key notes that I picked up through looking through these contracts

1. Merge.sol:
   - tokenId each have their associated `_values[address tokenId => uint256 mass]` values. These are used in generating the JSON string for the tokenURI. I think that a marketplace would just query the view function for `tokenURI()` for a respective tokenId, and get the typical trait data in a URI JSON. The subgraph or whatever database would do this at whatever instance of time to get all of the listings.
   - `_transfer()` calls `_merge()` after some conditional checking BUT `merge()` calls `_merge()` also. This fact plus the `require()` that the receiver and sender are the same address when merging the receiver and sender tokens, respectively... makes me believe that `_transfer()` is called typically for most of the merging action that is going on mainnet. Whereas `merge()` as a external function call is happening in some separate situation (not sure what).
   - TODO: understand the conditional logic that is before `_merge()` within `_transfer()`
   - TODO: understand the whole alpha, blue, yellow, red, etc.
   - TODO: knowing the remaining pieces, I can finish outlining the entities in my schema, and stub out the steps I will take when handling event, public view function, and other relevant data for this goal.

### ❓Questions So Far for DK

_*Questions not marked with an asterisk * have been answered. I will write in answers at a later date._

1. When querying a Subgraph, what does id represent? In the example query it shows that you can do `exampleEntities(first: 5)` and so I was wondering what each instance represents. Are those the last 5 entity saves from the mapping within the subgraph?
2. For the "Hodler" entity within the schema: I'd like your thoughts on the below:

   - Let's say that the smart contracts deletes the tokenId of the absorbed nft when merge() happens. If so, then mass Entity should update when merge() is called accordingly. I guess we'll just have missing/nullified IDs at some point in the subgraph? - So when a merge happens, a new mass is minted for one owner and the other owner loses their nft within the collection. So then their Hodler entity would become null. Within the mapping in the subgraph, this would happen by the merge event happening, the handler takes the param of the tokenId that was absorbed, or the address of the absorbed nft. It then nullifies the Hodler entity and updates the subgraph.

_`mapping.ts` task related:_

3. \*BigInt.fromI32, what is that? Looks like it comes from [here](https://github.com/graphprotocol/graph-ts/blob/master/common/numbers.ts). I think it just is handling numbers from blockchain data. Keeping it all the same format in the mapping and thus graph store.
4. How does it query IPFS data?
5. Where is the actual code 'binding' the abi of the smart contracts deployed on mainnet to subgraph here? // SP: I think it is the graph node itself, in our case the hosted service, that has the connection to the EVM. So using the specifications outlined when creating this subgraph, it then uses that to track the respective contract on the EVM through the node. From there it uses the ABI within this subgraph and then allows the mapping within this subgraph to do its thing with the incoming data from the blockchain and all other databases that the graph node is storing within the graph network!
6. \*What is the `return` variable within the logic on line ~287 within `Merge.sol`; it is not within a returns function.
7. Need to understand IDs more within subgraphs. When thinking about it for Sales, I see that `to` and `from` fields are `Bytes` whereas in the lending-standard-subgraph base schema, `id: ID` is used for `type Account`
8. Perhaps I just need to look at more subgraphs with fresh eyes, but when you use derivation, like in `sale: [Sales!]! @derivedFrom(filed: tokenID)`, if you wanted to obtain a specific field within the `Sales` database, how would you go about it? To me, right now we would just get the `id` field from `Sales` entity.
9. \*Redundancy: when making a schema, is it OK to have the same details as fields within two different entities? Ex.) The `User` vs `NFTs` entities; where there exists the same fields outlining pertinent details for each NFT. Would it be better to only instantiate a datafield once within one entity?
10. Regarding the function architecture I have within the mapping file for `merge.sol` revolving around `handleTransfer()` and `loadNFT()`
    Call loadNFT(), which has createNFT() within it in a similar if/else setup as this.
    If this is a new User entity, then it should not have any nfts within it. Therefore we just need to call loadNFT() which handles just loading up and returning an NFT appropriately. Hmm. but I think we should actually have the conditional logic checking if there is an NFT entity like that in existence. The reason is that we do not know if this is a new whitelisted address or something that could be receiving a transfer() of a pre-existing NFT. The counter to this thought is that the function becomes more complicated.
