import fs from 'fs'
import {Api, JsonRpc, RpcError} from 'eosjs'
import csvParse from 'csv-parse'
import fetch from 'node-fetch'
import getStream from 'get-stream'
import {JsSignatureProvider} from 'eosjs/dist/eosjs-jssig'

const snapshotFile = 'snapshot.csv'
const privateKey = 'PVT_K1_zE55YBmkfWADCVC3rcrj9oTX4PrM95BYFTMepqNR3YePW18hs'
const fromAccount = 'airdroptestr'
const eosNode = 'https://eos.greymass.com/'
const tokenContract = 'effecttokens'
const memo = 'EFX Genesis Airdrop'
const tokenSymbol = 'EFX'

interface Participant {
    account: string
    amount: number
}

const csvParticipants = async (): Promise<Participant[]> => {
    const parseStream = csvParse({delimiter: ','})
    const csvData = await getStream.array(fs.createReadStream(snapshotFile).pipe(parseStream))
    return csvData.map((line: any) => ({account: line[0], amount: line[1]} as Participant))
}

const action = (to: string, amount: any) => {
    return {
        account: tokenContract,
        name: 'transfer',
        authorization: [{
            actor: fromAccount,
            permission: 'active',
        }],
        data: {
            from: fromAccount,
            to: to,
            quantity: `${parseInt(amount).toFixed(4)} ${tokenSymbol}`,
            memo: memo,
        }
    }
}

const run = async () => {
    const participants: Participant[] = await csvParticipants()
    const actions = participants.map((participant) => action(participant.account, participant.amount))

    const signatureProvider = new JsSignatureProvider([privateKey])
    const rpc = new JsonRpc(eosNode, {fetch})
    const api = new Api({rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder()})

    try {
        const result = await api.transact({actions: actions}, {
            blocksBehind: 3,
            expireSeconds: 30,
        })
        console.dir(result)
    } catch (e) {
        console.log('\nCaught exception: ' + e)
        if (e instanceof RpcError) {
            console.log(JSON.stringify(e.json, null, 2))
        }
    }
}

run()
