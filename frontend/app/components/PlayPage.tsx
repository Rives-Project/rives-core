import { notFound } from "next/navigation";
import { ethers } from "ethers";
import React from 'react'

import { RuleInfo } from "../backend-libs/core/ifaces";
import { delay } from "../utils/util";
import { cartridge, rules } from "../backend-libs/core/lib";
import { envClient } from "../utils/clientEnv";
import ReportIcon from '@mui/icons-material/Report';
import RivemuPlayer from './RivemuPlayer';
import GameplaySubmitter from "./GameplaySubmitter";


const getRule = async (ruleId:string):Promise<RuleInfo> => {
    const formatedRuleId = ruleId;
    const data = await rules(
        {
            id:formatedRuleId
        },
        {
            decode:true,
            decodeModel:"RulesOutput",
            cartesiNodeUrl: envClient.CARTESI_NODE_URL,
            cache:"force-cache"
        }
    );
    
    if (data.total === 0 || data.data.length === 0) throw new Error(`Rule ${ruleId} not found!`);
    
    return data.data[0];
}

const getCartridgeData = async (cartridgeId:string) => {
    const formatedCartridgeId = cartridgeId.substring(0, 2) === "0x"? cartridgeId.slice(2): cartridgeId;
    const data = await cartridge(
        {
            id:formatedCartridgeId
        },
        {
            decode:true,
            decodeModel:"bytes",
            cartesiNodeUrl: envClient.CARTESI_NODE_URL,
            cache:"force-cache"
        }
    );
    
    if (data.length === 0) throw new Error(`Cartridge ${formatedCartridgeId} not found!`);
    
    return data;
}

export default async function PlayPage({cartridge_id, rule_id}:{cartridge_id?: string, rule_id?:string}) {

    let errorMsg:string|null = null;

    if (!(rule_id || cartridge_id) ) {
        errorMsg = "No rule or cartridge";
    }

    let rule:RuleInfo|null = null;
    cartridge_id = cartridge_id? cartridge_id: "";
    if (rule_id) {
        rule = await getRule(rule_id);
        cartridge_id = rule.cartridge_id;
    }

    // Rivemu parameters
    const args = rule?.args || "";
    const in_card = rule?.in_card && rule.in_card.length > 0 ? ethers.utils.arrayify(rule.in_card) : new Uint8Array([]);
    const score_function = rule?.score_function || "";
    let cartridgeData:Uint8Array|null = null;

    try {
        cartridgeData = await getCartridgeData(cartridge_id);
    } catch (error) {
        errorMsg = (error as Error).message;
    }


    if (errorMsg) {
        return (
            <main className="flex items-center justify-center h-lvh">
                <div className='flex w-96 flex-wrap break-all justify-center'>
                    <ReportIcon className='text-red-500 text-5xl' />
                    <span style={{color: 'white'}}> {errorMsg}</span>
                </div>
            </main>
        )
    }

    if (!cartridgeData) {
        return (
            <main className="flex items-center justify-center h-lvh">
                Getting Cartridge...
            </main>
        )
    }
  
    return (
        <main className="flex h-lvh items-center justify-center">
            <div className="grid grid-cols-1 gap-4 place-items-center ">
                <span style={{color: 'white'}}>{rule ? "Rule: " + rule?.name : "No rules"}</span>
                <RivemuPlayer cartridge_id={cartridge_id} rule_id={rule_id} cartridgeData={cartridgeData} args={args} in_card={in_card} scoreFunction={score_function} />
            </div>
            <GameplaySubmitter />
        </main>
    )
}