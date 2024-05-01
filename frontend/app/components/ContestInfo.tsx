"use client"



import { Tab } from '@headlessui/react'
import { RuleInfo } from '../backend-libs/core/ifaces'
import RuleLeaderboard from './RuleLeaderboard'
import { ContestStatus, getContestStatus } from '../utils/common'

function ContestInfo({contest}:{contest:RuleInfo}) {


    return (
        <Tab.Group vertical>
            <div className='flex items-start space-x-4 w-full'>
                <Tab.List className="vertical-option-tabs-header">
                    <Tab
                        className={({selected}) => {return selected?"game-tabs-option-selected":"game-tabs-option-unselected"}}
                        >
                            <span className='game-tabs-option-text'>
                                <span>Overview</span>
                            </span>
                    </Tab>

                    <Tab
                        className={({selected}) => {return selected?"game-tabs-option-selected":"game-tabs-option-unselected"}}
                        >
                            <span className='game-tabs-option-text'>
                                <span>Leaderboard</span>
                            </span>
                    </Tab>
                </Tab.List>

                <Tab.Panels className="overflow-auto custom-scrollbar w-full max-h-full">
                    <Tab.Panel className="game-tab-content">
                        {contest.description}
                    </Tab.Panel>

                    <Tab.Panel className="game-tab-content">
                        <RuleLeaderboard cartridge_id={contest.cartridge_id} rule={contest.id} 
                            get_verification_outputs={contest != undefined && [ContestStatus.INVALID,ContestStatus.VALIDATED].indexOf(getContestStatus(contest)) > -1 } 
                        />
                    </Tab.Panel>

                </Tab.Panels>
            </div>

        </Tab.Group>
    )
}

export default ContestInfo