import { BigNumberish, BytesLike, ethers, utils } from "ethers";
import { UserOperationBuilder } from "userop.js";
import { Client, UserOperationMiddlewareFn } from "userop.js";
import { Utils, Constants } from "userop.js";
import clc from "colors/safe";
import readline from "readline";
import process from "process";

export async function signInternal(privateKey: string, hex: string) {
    const signer = new ethers.Wallet(privateKey || "0x");
    const signature = await signer.signMessage(ethers.utils.arrayify(hex));
    return signature;
}

interface IGetUserInputOptions {
  question: string;
}

const voltaSupportInterface = new utils.Interface([
  "function execute(address,uint256,bytes)",
  "function deposit()"
]);

export function getDigest(opHash: string): string {
  return ethers.utils.hashMessage(utils.arrayify(opHash));
}

export async function getOpHash(builder: UserOperationBuilder, client: Client): Promise<string> {
    const opHash = await client.entryPoint.getUserOpHash(builder.getOp());
    return opHash;
}

export function getUserOpHash(builder: UserOperationBuilder, entryPoint: any, chainId: any) {
    const op = builder.getOp();
    const packed = ethers.utils.defaultAbiCoder.encode(
      [
        "address",
        "uint256",
        "bytes32",
        "bytes32",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "bytes32",
      ],
      [
        op.sender,
        op.nonce,
        ethers.utils.keccak256(op.initCode),
        ethers.utils.keccak256(op.callData),
        op.callGasLimit,
        op.verificationGasLimit,
        op.preVerificationGas,
        op.maxFeePerGas,
        op.maxPriorityFeePerGas,
        ethers.utils.keccak256(op.paymasterAndData),
      ]
    );

    const enc = ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "address", "uint256"],
      [ethers.utils.keccak256(packed), entryPoint, chainId]
    );

    return ethers.utils.keccak256(enc);
  }
export function handleGas(): UserOperationMiddlewareFn {
    return async (ctx) => {
      // increase 20% to avoid PreVerificationGas jumps.  feel free to set your own PVG
      const add20Pct = ethers.BigNumber.from("5");
      const vgl = ethers.BigNumber.from(ctx.op.verificationGasLimit);
      const pvg = ethers.BigNumber.from(ctx.op.preVerificationGas);
      const addvgl = vgl.div(add20Pct);
      const addpvg = pvg.div(add20Pct);
      ctx.op.verificationGasLimit = vgl.add(addvgl);
      ctx.op.preVerificationGas = pvg.add(addpvg);
      ctx.op.callGasLimit = ctx.op.callGasLimit > ctx.op.verificationGasLimit ? ctx.op.callGasLimit : ctx.op.verificationGasLimit;
    };
}

// custom to avoid rebuild
export async function sendVoltaUserOperation(
  builder: UserOperationBuilder, provider: ethers.providers.JsonRpcProvider
) {
  const op = builder.getOp();
  const userOpHash = ((await provider.send("eth_sendUserOperation", [
    Utils.OpToJSON(op),
    Constants.ERC4337.EntryPoint
  ])) as string);
  builder.resetOp();

  return {
    userOpHash,
  };
}

export async function buildExecuteCallData(to: string, value: BigNumberish, data: BytesLike): Promise<string> {
  return voltaSupportInterface.encodeFunctionData("execute", [
    to,
    value,
    data
  ]);
}

export async function buildWrapCallData(): Promise<string> {
  return voltaSupportInterface.encodeFunctionData("deposit", []);
}

export function getUserInput({ question }: IGetUserInputOptions): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close(); // Close the readline interface when done
      resolve(answer);
    });
  });
}
