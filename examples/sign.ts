import * as process from "process";
import { ethers } from "ethers";

import clc from "colors/safe";

// npx ts-node examples/sign.ts ${SIGNING_KEY1} ${SIGNING_KEY2...} 0xhash
async function signCmd() {
    const argv = process.argv;
    const hex = argv[argv.length-1];
    console.log("signing for hex: ", hex)
    const signatures: string[] = [];
    for (let i = 2; i < argv.length-1; i++) {
        const arg = argv[i];
        console.log(arg)
        const signer = new ethers.Wallet(arg);
        const signature = await signer.signMessage(ethers.utils.arrayify(hex));
        signatures.push(signature.slice(2));
    }
    console.log(clc.green(`\n0x${signatures.join("")}`));
}

signCmd();
