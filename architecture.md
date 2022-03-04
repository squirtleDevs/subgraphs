# 🧱 Architecture (WIP)

Although the merge NFT collection subgraph is made specifically for that collection. It is a good exercise to think about other NFT collections and if there is a common architecture that satisfies most of them. Stakeholders need to be identified first before creating architecture that satisfies their individual needs:

- Subgraph developers (usually developers within the NFT core team)
- Data analysts (crypto data companies; ex.) Messari, trad-fi companies, NFT dashboards, etc.)
- Indexers
- Curators
- The Graph Foundation / Edge and Node / other teams

Some assumptions for this base NFT subgraph:

- Code will live within this squirtle dev repo for now.
- Documentation will be outlined for the base schema.

## 📄 Base Schema

Now we consider what the base schema will look like.

Some basic guidelines:

- It should be simple enough for a traditional finance data scientist to read the schema and query it and fully understand what is going on. No blockchain experience required.
- But it should be descriptive enough so that someone can get useful information out of it. Hence why it revolves around NFTs, and we need to standardize NFT nomenclature.

This is just a starting point. I have written out the architectural decisions for the pak merge collection as an example below:

## ⚫️ Pak merge. Collection Subgraph Schema

Let's think about this in databases, and how they may connect with one another. As well let's identify which stakeholders would use these databases.

Databases marked with an asterisk\* have specific details in addition to the base schema for this pak collection.

\*Database 1: Users

- Stakeholders: Data analysts & front ends would use this.
- It provides all the details just like a marketplace would need aside from sales information.

\*Database 2: NFTs themselves

- Stakeholders: Data analysts & front ends.
- It provides info for visual representations of the collection as a whole at any point in time.

\*Database 3: Collection as a whole (global)

- Stakeholders: Data analysts & front ends.

Database 4: Sales

- Stakeholders: Data analysts & front ends & marketplaces.
- Provides pertinent information for transfers of any particular NFT within a collection.

Database 5: ERC-20s used for purchasing

- Stakeholders: Data analysts & front ends & marketplaces.
- Provides details on the digital assets used to pay for NFTs during sales.
