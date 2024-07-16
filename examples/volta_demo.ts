import {
    UserOperationBuilder, Utils, Client, Constants, Presets
} from "userop.js";
import {
    buildExecuteCallData,
    buildWrapCallData,
    getUserOpHash,
    getUserInput,
    handleGas,
    sendVoltaUserOperation,
    signInternal
} from "./utils";
import * as process from "process";
import { ethers } from "ethers";
import clc from "colors/safe";

const bundlerBaseUrl = "https://api-bundler.dev.voltacircuit.com"; // prod: https://api-bundler.voltacircuit.com
const PRIVATEKEY = process.env.VOLTA_PRIVATE_KEY || "";
const CHAIN = process.env.VOLTA_CHAIN || "arbitrum-mainnet";
const CHAINID = process.env.VOLTA_CHAIN_ID || "0xa4b1";


// read from cli params
const argv = process.argv;
const vaultAddress = argv[2]; // vault address

const bundlerUrl = `${bundlerBaseUrl}/${CHAIN}`;
const provider = new ethers.providers.JsonRpcProvider(bundlerUrl);

async function run() {
    const client = await Client.init(bundlerUrl, {
        entryPoint: Constants.ERC4337.EntryPoint,
        overrideBundlerRpc: bundlerUrl
    });

    // userOp Builder
    const builder = new UserOperationBuilder().useDefaults({});
    // set sender Address
    builder.setPartial({ sender: vaultAddress });
    // set nonce
    const nonce = await client.entryPoint.getNonce(vaultAddress, 0);
    builder.setPartial({ nonce: nonce });
    // this assumes that the vault has been created through the UI and at least
    // 1 transaction was performed on it.  under account abstraction, a wallet
    // is not actually deployed until the user transacts with the wallet (deposits don't count)
    builder.setPartial({ initCode: undefined });

    await getUserInput({ question: clc.green("Enter action (transfer,wrap): ") }).then(async (input) => {
        switch (input) {
            case 'transfer':
                await buildTransferData(builder)
                break
            case 'wrap':
                await buildWrapData(builder)
                break
            default:
                console.log(clc.america("Stopped"))
                return
        }
    }).catch((error) => {
        console.error(clc.red(`Error: ${error.stack}`));
        return
    });

    // estimate callGasLimit, verificationGasLimit, preVerificationGas, maxFeePerGas, maxPriorityFeePerGas
    builder
        .useMiddleware(Presets.Middleware.getGasPrice(provider))
        // if speed is a concern, it is recommended not to use this middleware
        // gas limits do not change between runs.  Instead, simply hard code
        // the expected values below in buildTransferData
        .useMiddleware(Presets.Middleware.estimateUserOperationGas(provider))
        .useMiddleware(handleGas());

    await builder.buildOp(Constants.ERC4337.EntryPoint, CHAINID);

    // get signature
    await sendOp(builder)
}

async function buildTransferData(builder: UserOperationBuilder) {
    let targetAddress = ""
    let amountInWei = ethers.BigNumber.from(0)
    await getUserInput({ question: clc.green("Enter target address: ") }).then(async (target) => {
        targetAddress = target
    })
    await getUserInput({ question: clc.green("Enter amount (format 0.001): ") }).then(async (amount) => {
        amountInWei = ethers.utils.parseUnits(amount, "ether")
    })
    builder.setPartial({
        callData: await buildExecuteCallData(targetAddress, amountInWei, []),
        // maxFeePerGas: ethers.utils.parseUnits("0.021", "gwei"), // set your own gas
        // preVerificationGas: ethers.BigNumber.from(90000) // set your own PVG instead of guesstimating it through simulation
    })
}

async function buildWrapData(builder: UserOperationBuilder) {
    let targetAddress = ""
    let amountInWei = ethers.BigNumber.from(0)
    await getUserInput({ question: clc.green("Enter wrap token address (arbitrum-mainnet: 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1): ") }).then(async (target) => {
        targetAddress = target
    })
    await getUserInput({ question: clc.green("Enter amount (format 0.001): ") }).then(async (amount) => {
        amountInWei = ethers.utils.parseUnits(amount, "ether")
    })
    const data = await buildWrapCallData()
    builder.setPartial({
        callData: await buildExecuteCallData(targetAddress, amountInWei, data)
    })
}

async function sendOp(builder: UserOperationBuilder) {
    const opHash = getUserOpHash(builder, Constants.ERC4337.EntryPoint, CHAINID);
    let sig = "";
    if(PRIVATEKEY != "") {
        const opHash = getUserOpHash(builder, Constants.ERC4337.EntryPoint, CHAINID);
        sig = await signInternal(PRIVATEKEY, opHash);
    } else {
        sig = await getUserInput({ question: clc.green(`Combined signature for opHash (${opHash}): `) })
    }
    builder.setPartial({ signature: sig });
    console.log(clc.blue(`Sending ops to Volta bundler...`));
    const response = await sendVoltaUserOperation(builder, provider);
    console.log(clc.green(`UserOp_hash: ${response?.userOpHash}`));
    console.log(clc.green(`url: https://jiffyscan.xyz/userOpHash/${response.userOpHash}`));
}

run();
