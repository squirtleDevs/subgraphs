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
- [ ] Review with DK to see what parts could be improved. Do through PRs on github.

---

### 🔎 Perspective of Subgraph

There are two perspectives for this Subgraph.

1. Existing and Potential Investors in the project interesting in the game metrics
2. NFT Marketplaces like OpenSea

---

### ❓Questions So Far for DK

1. When querying a Subgraph, what does id represent? In the example query it shows that you can do `exampleEntities(first: 5)` and so I was wondering what each instance represents. Are those the last 5 entity saves from the mapping within the subgraph?
2. For the "Hodler" entity within the schema: I'd like your thoughts on the below:

   - Let's say that the smart contracts deletes the tokenId of the absorbed nft when merge() happens. If so, then mass Entity should update when merge() is called accordingly. I guess we'll just have missing/nullified IDs at some point in the subgraph? - So when a merge happens, a new mass is minted for one owner and the other owner loses their nft within the collection. So then their Hodler entity would become null. Within the mapping in the subgraph, this would happen by the merge event happening, the handler takes the param of the tokenId that was absorbed, or the address of the absorbed nft. It then nullifies the Hodler entity and updates the subgraph.
