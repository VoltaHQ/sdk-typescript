import {
    UserOperationBuilder, Utils, Client, Constants, Presets
} from "userop.js";
import {
    buildExecuteCallData,
    getUserOpHash,
    getUserInput,
    handleGas,
    sendVoltaUserOperation,
    signInternal,
} from "./utils";
import * as process from "process";
import { ethers } from "ethers";
import clc from "colors/safe";

const PRIVATEKEY = process.env.VOLTA_PRIVATE_KEY || "";
const CHAIN = process.env.VOLTA_CHAIN || "arbitrum-mainnet";
const CHAINID = process.env.VOLTA_CHAIN_ID || "0xa4b1";

const bundlerBaseUrl = "https://api-bundler.dev.voltacircuit.com"; // prod: https://api-bundler.voltacircuit.com

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

    // the Vault has to be initialized through the Volta Dashboard before running these examples
    builder.setPartial({ initCode: "0x" });

    await buildTransferData(builder)

    // estimate callGasLimit, verificationGasLimit, preVerificationGas, maxFeePerGas, maxPriorityFeePerGas
    builder
        .useMiddleware(Presets.Middleware.getGasPrice(provider))
        // if speed is a concern, it is recommended not to use this middleware
        // gas limits do not change between runs.  Instead, simply hard code
        // the expected values below in buildTransferData
        .useMiddleware(Presets.Middleware.estimateUserOperationGas(provider))
        .useMiddleware(handleGas())

    await builder.buildOp(Constants.ERC4337.EntryPoint, "0x1");
    // generate signature
    await sendOp(builder, true)
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

async function sendOp(builder: UserOperationBuilder, signLocally: boolean) {
    try {
        let sig: string;
        if (signLocally) {
            const opHash = getUserOpHash(builder, Constants.ERC4337.EntryPoint, CHAINID);
            sig = await signInternal(PRIVATEKEY, opHash);
        } else {
            sig = await getUserInput({ question: clc.green("Combined signature for opHash (yarn sign): ") });
        }
        builder.setPartial({ signature: sig });
        console.log(clc.blue(`Sending ops to Volta bundler...`));
        const response = await sendVoltaUserOperation(builder, provider);
        console.log(clc.green(`UserOp_hash: ${response?.userOpHash}`));
        console.log(clc.green(`url: https://jiffyscan.xyz/userOpHash/${response.userOpHash}`));
    } catch(error) {
        console.error(clc.red(`${error}`));
    };
}

run();
