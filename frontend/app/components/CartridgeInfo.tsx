"use client"

import { ContractReceipt, ethers } from "ethers";
import React, { Suspense, useContext, useEffect, useRef, useState } from 'react'
import { selectedCartridgeContext } from '../cartridges/selectedCartridgeProvider';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import PublishIcon from '@mui/icons-material/Publish';
import UploadIcon from '@mui/icons-material/Upload';
import DownloadIcon from '@mui/icons-material/Download';
import { Tab } from '@headlessui/react'
import { Canvas } from '@react-three/fiber';
import DescriptionIcon from '@mui/icons-material/Description';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import CachedIcon from '@mui/icons-material/Cached';
import StadiumIcon from '@mui/icons-material/Stadium';
import CodeIcon from '@mui/icons-material/Code';
import useDownloader from "react-use-downloader";
import { useConnectWallet } from "@web3-onboard/react";
import QRCode from "react-qr-code";

import Cartridge from "../models/cartridge";
import {SciFiPedestal} from "../models/scifi_pedestal";
import Loader from "../components/Loader";
import { ReplayScore, getOutputs, replay } from '../backend-libs/app/lib';
import { Replay } from '../backend-libs/app/ifaces';
import CartridgeDescription from './CartridgeDescription';
import Link from 'next/link';
import CartridgeScoreboard from './CartridgeScoreboard';
import { envClient } from "../utils/clientEnv";
import { delay } from "../utils/util";
import CheckIcon from "./svg/CheckIcon";
import ErrorIcon from "./svg/ErrorIcon";
import CloseIcon from "./svg/CloseIcon";
import { sha256 } from "js-sha256";
import nftAbiFile from "../contracts/RivesScoreNFT.sol/RivesScoreNFT.json"

const nftAbi: any = nftAbiFile;

enum STATUS {
    READY,
    VALIDATING,
    VALID,
    INVALID,
}

interface LOG_STATUS {
    cartridgeId:string,
    status:STATUS,
    error?:string
}

function logFeedback(logStatus:LOG_STATUS, setLogStatus:Function) {
    if (logStatus.status === STATUS.VALID) {
        delay(2500).then(() =>{
            setLogStatus({status: STATUS.READY} as LOG_STATUS);
        })
        return (
            <div className="fixed flex items-center max-w-xs p-4 space-x-4 text-gray-500 bg-white rounded-lg shadow-lg right-5 bottom-20 dark:text-gray-400 dark:divide-gray-700 space-x dark:bg-gray-800" role="alert">
                <CheckIcon/>
                <div className="ms-3 text-sm font-bold">Log Sent</div>
            </div>
        )
    } else if (logStatus.status === STATUS.INVALID) {
        const click = () => {
            setLogStatus({status: STATUS.READY} as LOG_STATUS)
        }
        return (
            <div className="fixed flex-col items-center max-w-xs p-4 space-x-4 text-gray-500 bg-white rounded-lg shadow right-5 bottom-[20%] dark:text-gray-400 dark:divide-gray-700 space-x dark:bg-gray-800" role="alert">
                <div className="flex items-center pb-1 border-b">
                    <ErrorIcon/>
                    <div className="ms-3 text-sm font-normal">Invalid Log.</div>
                    <button onClick={click} type="button" className="ms-auto -mx-1.5 -my-1.5 bg-white text-gray-400 hover:text-gray-900 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-100 inline-flex items-center justify-center h-8 w-8 dark:text-gray-500 dark:hover:text-white dark:bg-gray-800 dark:hover:bg-gray-700" data-dismiss-target="#toast-danger" aria-label="Close">
                        <span className="sr-only">Close</span>
                        <CloseIcon/>
                    </button>
                </div>
                <div>
                    {logStatus.error}
                </div>
            </div>
        )
    }
}


function scoreboardFallback() {
    const arr = Array.from(Array(3).keys());

    return (
        <table className="w-full text-xs text-left">
            <thead className="text-xsuppercase">
                <tr>
                    <th scope="col" className="px-2 py-3">
                        User
                    </th>
                    <th scope="col" className="px-2 py-3">
                        Timestamp
                    </th>
                    <th scope="col" className="px-2 py-3">
                        Score
                    </th>
                    <th scope="col" className="px-2 py-3">
                        Status
                    </th>
                    <th scope="col" className="px-2 py-3">

                    </th>
                </tr>
            </thead>
            <tbody className='animate-pulse'>
                {
                    arr.map((num, index) => {
                        return (
                            <tr key={index}>
                                <td className="px-2 py-4 break-all">
                                    <div className='ps-4 fallback-bg-color rounded-md'>
                                        0xf39F...2266
                                    </div>
                                </td>

                                <td className="px-2 py-4">
                                    <div className='fallback-bg-color rounded-md'>
                                        31/12/1969, 21:06:36 PM
                                    </div>
                                </td>

                                <td className="px-2 py-4">
                                    <div className='fallback-bg-color rounded-md'>
                                        100
                                    </div>
                                </td>
                                <td className="px-2 py-4">
                                    <div className='fallback-bg-color rounded-md'>
                                        100
                                    </div>
                                </td>
                                <td className="w-[50px] h-[56px]">
                                    <div className='fallback-bg-color rounded-md'>
                                        100
                                    </div>
                                </td>
                            </tr>
                        );
                    })
                }

            </tbody>
        </table>
    )
}

function CartridgeInfo() {
    const {selectedCartridge, playCartridge, setGameplay, setReplay} = useContext(selectedCartridgeContext);
    const fileRef = useRef<HTMLInputElement | null>(null);
    const [{ wallet }] = useConnectWallet();
    const { download } = useDownloader();
    const [submitLogStatus, setSubmitLogStatus] = useState({status: STATUS.READY} as LOG_STATUS);
    const [reloadScoreboardCount, setReloadScoreboardCount] = useState(0);

    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [showNftLinkModal, setShowNftLinkModal] = useState(false);
    const [mintUrl, setMintUrl] = useState("/mint/1");
    const [userAlias, setUserAlias] = useState('');
    const [bypassSubmitModal, setBypassSubmitModal] = useState(false);

    useEffect(() => {
        // auto reload scoreboard only if
        // gameplay log sent is valid and the selected cartridge is the same of the gameplay sent
        if (submitLogStatus.status === STATUS.VALID && submitLogStatus.cartridgeId === selectedCartridge?.id) {
            setReloadScoreboardCount(reloadScoreboardCount+1);
        }
    }, [submitLogStatus])

    useEffect(() => {
        if (selectedCartridge?.gameplayLog) submitLog();
    }, [selectedCartridge?.gameplayLog])

    if (!selectedCartridge) return <></>;

    var decoder = new TextDecoder("utf-8");

    async function submitLog() {
        // replay({car});
        if (!selectedCartridge || !selectedCartridge.gameplayLog){
            alert("No gameplay data.");
            return;
        }
        if (!selectedCartridge.outcard || !selectedCartridge.outhash ){
            alert("No gameplay output yet, you should run it.");
            return;
        }
        if (!wallet) {
            alert("Connect first to upload a gameplay log.");
            return;
        }

        if (bypassSubmitModal)
            submitLogWithAlias(userAlias);
        else
            setShowSubmitModal(true);
    }

    async function submitLogWithAlias(userAliasToSubmit:string = "") {
        // replay({car});
        if (!selectedCartridge || !selectedCartridge.gameplayLog){
            return;
        }
        if (!selectedCartridge.outcard || !selectedCartridge.outhash ){
            return;
        }
        if (!wallet) {
            return;
        }
        setUserAlias(userAliasToSubmit);
        const signer = new ethers.providers.Web3Provider(wallet.provider, 'any').getSigner();
        const inputData: Replay = {
            user_alias:userAliasToSubmit,
            cartridge_id:"0x"+selectedCartridge.id,
            outcard_hash: '0x' + selectedCartridge.outhash,
            args: selectedCartridge.args || "",
            in_card: selectedCartridge.inCard ? ethers.utils.hexlify(selectedCartridge.inCard) : "0x",
            log: ethers.utils.hexlify(selectedCartridge.gameplayLog)
        }
        console.log("Sending Replay:")
        if (decoder.decode(selectedCartridge.outcard.slice(0,4)) == 'JSON') {
            console.log("Replay Outcard",JSON.parse(decoder.decode(selectedCartridge.outcard).substring(4)))
        } else {
            console.log("Replay Outcard",selectedCartridge.outcard)
        }
        console.log("Replay Outcard hash",selectedCartridge.outhash)


        setSubmitLogStatus({cartridgeId: selectedCartridge.id, status: STATUS.VALIDATING});
        try {
            const receipt = await replay(signer, envClient.DAPP_ADDR, inputData, {sync:false, cartesiNodeUrl: envClient.CARTESI_NODE_URL}) as ContractReceipt;

            if (receipt == undefined || receipt.events == undefined)
                throw new Error("Couldn't send transaction");

            const inputEvent = receipt.events[0];
            const inputIndex = inputEvent.args && inputEvent.args[1];
            if (inputIndex == undefined)
                throw new Error("Couldn't get input index");

            setSubmitLogStatus({cartridgeId: selectedCartridge.id, status: STATUS.VALID});

            let signature = "";
            const nftContract = new ethers.Contract(envClient.NFT_ADDR,nftAbi.abi,signer);

            const code = await nftContract.provider.getCode(nftContract.address);
            if (code == '0x') {
                console.log("Couldn't get nft contract")
            } else if ((await signer.getAddress()).toLowerCase() == (await nftContract.operator()).toLowerCase()) {
                const gameplayHash = sha256(selectedCartridge.gameplayLog);
                const signedHash = await signer.signMessage(ethers.utils.arrayify("0x"+gameplayHash));
                signature = `?signature=${signedHash}`;
            }

            setMintUrl(`/mint/${Number(inputIndex._hex)}${signature}`)
            setShowNftLinkModal(true);

        } catch (error) {
            setSubmitLogStatus({cartridgeId: selectedCartridge.id, status: STATUS.INVALID, error: (error as Error).message});
        }
        // TODO: test mint
    }

    async function uploadLog() {
        // replay({car});
        fileRef.current?.click();
    }

    async function downloadLog() {
        // replay({car});
        const filename = "gameplay.rivlog";
        const blobFile = new Blob([selectedCartridge?.gameplayLog!], {
            type: "application/octet-stream",
        });
        const file = new File([blobFile], filename);
        const urlObj = URL.createObjectURL(file);
        download(urlObj, filename);
    }

    function handleOnChange(e: any) {
        const reader = new FileReader();
        reader.onload = async (readerEvent) => {
            const data = readerEvent.target?.result;
            if (data) {
                setGameplay(new Uint8Array(data as ArrayBuffer), undefined);
                e.target.value = null;
            }
        };
        reader.readAsArrayBuffer(e.target.files[0])
    }

    async function prepareReplay(replayScore: ReplayScore) {
        if (selectedCartridge) {
            const replayLog: Array<Uint8Array> = await getOutputs(
                {
                    tags: ["replay", selectedCartridge?.id],
                    timestamp_gte: replayScore.timestamp.toNumber(),
                    timestamp_lte: replayScore.timestamp.toNumber(),
                    msg_sender: replayScore.user_address,
                    output_type: 'report'
                },
                {cartesiNodeUrl: envClient.CARTESI_NODE_URL}
            );
            if (replayLog.length > 0) {
                setReplay(replayLog[0]);
            }
        }
    }


    return (
        <div className="flex flex-wrap justify-center h-full w-full">
            <div className="w-64 h-96">
                <Canvas shadows camera={ {near: 0.1, far: 1000, position: [0,0,0]} }>
                    <Suspense fallback={<Loader />}>
                        <ambientLight intensity={1} />
                        <pointLight position={[4, -5, -10]} intensity={20} />
                        <pointLight position={[-4, -5, -10]} intensity={20} />
                        <spotLight
                            position={[0, -5, -10]}
                            angle={Math.PI}
                            penumbra={1}
                            intensity={80}
                        />
                        <hemisphereLight
                            color='#b1e1ff'
                            groundColor='#000000'
                            intensity={1}
                        />

                        <Cartridge
                        rotation={[0, -Math.PI/2, 0]}
                            key={selectedCartridge.cover}
                            position={[0,0,-10]}
                            cover={selectedCartridge.cover? `data:image/png;base64,${selectedCartridge.cover}`:"/cartesi.jpg"}
                            scale={[1, 1, 1]}
                        />
                        <SciFiPedestal position={[0, -5, -10]} scale={[0.3,0.3,0.3]}/>

                    </Suspense>
                </Canvas>
            </div>

            <div className="md:w-[512px] lg:w-[768px]">
                <div className="text-white mb-2">
                    <span className='text-4xl'>{selectedCartridge.name}</span>

                    {
                    !(selectedCartridge.info?.authors)?
                        <div className='h-6'></div>
                    :
                    (
                        <div className='flex space-x-2'>
                            <span>By</span>
                            <ul>
                                {selectedCartridge.info?.authors?.map((author, index) => (
                                    <li key={author.name}>
                                        <Link href={author.link}>
                                            {author.name}{index !== selectedCartridge.info!.authors!.length-1? ",": ""}
                                        </Link>
                                    </li>
                                ))}
                            </ul>

                        </div>
                    )
                    }
                </div>

                <Tab.Group>
                    <Tab.List className="game-option-tabs-header">
                        <Tab
                            className={({selected}) => {return selected?"game-tabs-option-selected":"game-tabs-option-unselected"}}
                            >
                                <span className='game-tabs-option-text'>
                                    <DescriptionIcon/>
                                    <span>Description</span>
                                </span>
                        </Tab>

                        <Tab
                            className={({selected}) => {return selected?"game-tabs-option-selected":"game-tabs-option-unselected"}}
                            >
                                <span className='game-tabs-option-text'>
                                    <LeaderboardIcon/>
                                    <span>Scoreboard</span>
                                </span>
                        </Tab>

                        {/* <Tab
                            className={({selected}) => {return selected?"game-tabs-option-selected":"game-tabs-option-unselected"}}
                            >
                                <span className='game-tabs-option-text'>
                                    <StadiumIcon/>
                                    <span>Tournaments</span>
                                </span>
                        </Tab>

                        <Tab
                            className={({selected}) => {return selected?"game-tabs-option-selected":"game-tabs-option-unselected"}}
                            >
                                <span className='game-tabs-option-text'>
                                    <CodeIcon/>
                                    <span>Mods</span>
                                </span>
                        </Tab> */}
                    </Tab.List>

                    <Tab.Panels className="mt-2 overflow-auto custom-scrollbar">
                        <Tab.Panel className="game-tab-content ">
                            <CartridgeDescription/>
                        </Tab.Panel>

                        {/* lg: width is equal to the max-w-3xl */}
                        <Tab.Panel className="game-tab-content">
                            <div className="w-full flex">
                                <button className="ms-auto scoreboard-btn" onClick={() => setReloadScoreboardCount(reloadScoreboardCount+1)}><span><CachedIcon/></span></button>
                            </div>
                            <Suspense fallback={scoreboardFallback()}>
                                <CartridgeScoreboard cartridge_id={selectedCartridge.id} reload={reloadScoreboardCount} replay_function={prepareReplay}/>
                            </Suspense>

                        </Tab.Panel>

                        {/* <Tab.Panel className="game-tab-content">
                            Coming Soon!
                        </Tab.Panel>

                        <Tab.Panel className="game-tab-content">
                            Coming Soon!
                        </Tab.Panel> */}
                    </Tab.Panels>
                </Tab.Group>

                {/* <div>
                    <CartridgeDescription/>
                </div> */}

                {
                    selectedCartridge.downloading?
                        <button className="btn w-full mt-2 flex justify-center">
                            <div className='w-5 h-5 border-2 rounded-full border-current animate-spin'></div>
                        </button>
                    :
                        <button className="btn w-full mt-2" onClick={() => {playCartridge()}}>
                            PLAY
                        </button>

                }
            </div>

            {/* <div className="bg-white justify-self-end -mt-[152px]">
                <div className="w-full flex">
                    <button className="ms-auto scoreboard-btn" onClick={() => setReloadScoreboardCount(reloadScoreboardCount+1)}><span><CachedIcon/></span></button>
                </div>
                <Suspense fallback={scoreboardFallback()}>
                    <CartridgeScoreboard cartridge_id={selectedCartridge.id} reload={reloadScoreboardCount} replay_function={prepareReplay}/>
                </Suspense>
            </div> */}

            <NftLinkModal showModal={showNftLinkModal} setShowModal={setShowNftLinkModal} url={mintUrl} />
            <SubmitModal showModal={showSubmitModal} setShowModal={setShowSubmitModal} acceptFunction={submitLogWithAlias} bypassModal={setBypassSubmitModal} />
        </div>
    );
}


function NftLinkModal({showModal,setShowModal,url}:{showModal:boolean,setShowModal(s:boolean):void,url:String}) {
    return (
      <>
        {showModal ? (
          <>
            <div
              className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-30 outline-none focus:outline-none"
            >
              <div className="relative w-auto my-6 mx-auto max-w-3xl">
                {/*content*/}
                <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-gray-500 outline-none focus:outline-none">
                    {/*header*/}
                    <div className='relative p-2 text-center'>
                        <span>Score NFT</span>
                        <button className="absolute top-1 end-2.5 rounded p-2 border border-gray-500 hover:border-black"
                        onClick={() => setShowModal(false)}
                        >
                            <CloseIcon/>
                        </button>
                    </div>
                  {/*body*/}
                  <div className="relative py-2 px-6 flex-auto items-center">
                    <button className="place-self-center" title='Nft Score Screenshot' onClick={() => window.open(`${url}`, "_blank", "noopener,noreferrer")}>
                        <div style={{ height: "auto", margin: "0 auto", maxWidth: 200, width: "100%" }} >
                            <QRCode
                            size={200}
                            style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                            value={`${window.location.origin}${url}`}
                            viewBox={`0 0 200 200`}
                            />
                        </div>
                    </button>
                  </div>
                  {/*footer*/}
                  <div className="flex items-center justify-end pb-2 pr-6">
                    <button
                      className={`games-list-item`}
                      type="button"
                      onClick={() => setShowModal(false)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="opacity-25 fixed inset-0 z-20 bg-black"></div>
          </>
        ) : null}
      </>
    );
  }

function SubmitModal({showModal,setShowModal,acceptFunction,bypassModal}:{showModal:boolean,setShowModal(s:boolean):void,acceptFunction(s:string):void,bypassModal(s:boolean):void}) {
    const [alias, setAlias] = useState('');
    const [bypass, setBypass] = useState(false);

    return (
      <>
        {showModal ? (
          <>
            <div
              className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-30 outline-none focus:outline-none"
            >
              <div className="relative w-auto my-6 mx-auto max-w-3xl">
                {/*content*/}
                <div className="border-0 shadow-lg relative flex flex-col w-full bg-gray-500 outline-none focus:outline-none">
                  {/*header*/}
                    <div className='relative p-2 text-center'>
                        <span>Submit Gameplay</span>
                        <button className="absolute top-1 end-2.5 rounded p-2 border border-gray-500 hover:border-black"
                        onClick={() => setShowModal(false)}
                        >
                            <CloseIcon/>
                        </button>
                    </div>
                  {/*body*/}
                    <fieldset className={`relative my-6 px-6 flex-auto h-full`}>
                        <div >
                            <legend>
                                user alias
                            </legend>
                            <input type="text" maxLength={12} value={alias} onChange={e => setAlias(e.target.value.slice(0, 12))} />
                        </div>
                        <div className="mt-2">
                            <input id="bypass-checkbox" type="checkbox" checked={bypass} onChange={e => setBypass(e.target.checked)} >
                            </input>
                            <label htmlFor="bypass-checkbox" className="ms-2">
                                remember my alias
                            </label>
                        </div>
                    </fieldset>
                    <div className="flex items-center justify-end pb-2 pr-6">
                        <button
                        className={`bg-red-500 text-white font-bold uppercase text-sm px-6 py-2 border border-red-500 hover:text-red-500 hover:bg-transparent`}
                        type="button"
                        onClick={() => setShowModal(false)}
                        >
                            Cancel
                        </button>
                        <button
                        className={`bg-emerald-500 text-white font-bold uppercase text-sm px-6 py-2 ml-1 border border-emerald-500 hover:text-emerald-500 hover:bg-transparent`}
                        type="button"
                        onClick={() => {acceptFunction(alias);bypassModal(bypass);setShowModal(false);}}
                        >
                            Submit
                        </button>
                    </div>
                </div>
              </div>
            </div>
            <div className="opacity-25 fixed inset-0 z-20 bg-black"></div>
          </>
        ) : null}
      </>
    );
  }
export default CartridgeInfo