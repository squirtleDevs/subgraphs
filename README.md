# 🛰 Subgraphs

The intent of this repo is to document the creation of my first subgraph.

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
   - Details of the NFT (URI or detailed metadata)
   - From glancing at this [BAYC](https://opensea.mypinata.cloud/ipfs/QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/8372), I believe that the trait_type that OpenSea and other marketplaces want are to be stored in a JSON file like this. Then the marketplace parses that information and obtains what they need for the classes and trait types.
   - This is confirmed from looking at OpenSea's docs for how to set up [metadata](https://docs.opensea.io/docs/metadata-standards#:~:text=OpenSea%20supports%20the%20storage%20of,format%20ipfs%3A%2F%2F%20.).

When someone hits the API endpoint of this subgraph, they will get rich data that exposes all of these data points. From an architectural view though, if the data associated to either of these perspectives are large, we would need to consider creating two separate subgraphs so indexing and querying is faster.

   </details>

---

## ⭐️ First Subgraph Plan (merge)

I am going with the Pak merge project and creating a subgraph for it.

My instructions at the start were to think about what the useful data would be for the open sea front end, and extract that data from the contracts.

From glancing through OpenSea and the merge contracts:

1. [Opensea listings of merge collection](https://opensea.io/assets/m?search[sortAscending]=true&search[sortBy]=PRICE)
2. [merge contract on mainnet](https://etherscan.io/address/0xc3f8a0f5841abff777d3eefa5047e8d413a1c9ab#code) && [merge metadata contract on mainnet](https://etherscan.io/address/0x4e1e18aaccdf9acfd2e8847654a3871dfd234f02#code)

---

## TODO

- [x] Finish merge subgraph to the point of showing details of the collection (without sales details for now and URI)
- [/] Write and finalize README to share with scaffold-eth so people have another reference point on how to make a subgraph
- [ ] Integrate into scaffold eth feature branch and let people create a front-end for it
