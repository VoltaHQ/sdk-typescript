# Description

Volta is a new and powerful smart contract wallet to manage crypto assets and ehance operational security.
Unlike all other solutions out there we separate
key security (MPC vs Single-Signature Wallets for example) from the actual custody of the assets. We allow you to get the best of both
worlds. For example, with our delegation framework, you are able to have the security of a hardware wallet and the ease of use of
something like MetaMask.

In other words, you can use ledger device(s) as the primary multi-sig owners of the wallet, and then delegate certain activities
to your or others' signing wallet (like metamask). Those signing wallets do not need to hold any funds at all and only serve as
a way to verify the identity and authorization of the user. Volta does not hold or maintain any of the private keys.

# Getting started

## Prerequisite

- Node 16 or later
- npx 10.8.1 or later
- ts-node v10.9.2

## Volta Setup

1. Make sure your vault is setup first on the [Volta Dashboard](https://dashboard.dev.voltacircuit.com).
2. Create a new ETH private key + address using this [BIP39](https://iancoleman.io/bip39/) tool. This is an easy way to create signing keys
3. Add the address from step #2 as a user on your vault and assign the delegation rules you wish to grant/test
4. Keep the associated private key handy because we will need in later steps

## Setup

Install dependencies:

```bash
yarn install
```

The example defaults to using arbitrum-mainnet. But you can modify the code to use any other chain by updating the following env vars:

```
export VOLTA_CHAIN="arbitrum-mainnet" VOLTA_CHAIN_ID="0xa4b1"
```

## RUN

Note: Fund vault with native token

Run demo with parameters:

```bash
npx ts-node examples/volta_demo.ts $MY_VAULT_ADDRESS
```

## Signing

Signing util - last param is opHash of userOp. pk2+ are optional

```bash
yarn sign <pk1> <pk2> ... <ophash>
```
