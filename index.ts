import fs from 'fs'
import {Api, JsonRpc, RpcError} from 'eosjs'
import csvParse from 'csv-parse'
import fetch from 'node-fetch'
import getStream from 'get-stream'
import {JsSignatureProvider} from 'eosjs/dist/eosjs-jssig'

const privateKey = ''
const fromAccount = ''
const eosNode = 'https://eos.greymass.com/'
const tokenContract = 'effecttokens'
const snapshotFile = 'distribution_test.csv'
const memo = 'fee distribution'

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
            quantity: `${parseFloat(amount).toFixed(4)} ${tokenSymbol}`,
            memo: memo,
        }
    }
}

function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}

const chunk = (arr: any[], size: number) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
    arr.slice(i * size, i * size + size)
  );

const run = async () => {
    const participants: Participant[] = await csvParticipants()
    const actions = participants.map((participant) => action(participant.account, participant.amount))
    const chunks = chunk(actions, 4)

    const signatureProvider = new JsSignatureProvider([privateKey])
    const rpc = new JsonRpc(eosNode, {fetch})
    const api = new Api({rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder()})

    for (let i = 0; i < chunks.length; i++) {
        const elm = chunks[i]
        await delay(2000)
        try {
            const result = await api.transact({actions: elm}, {
                blocksBehind: 3,
                expireSeconds: 30,
            })
            console.dir(result)
        } catch (e) {
            console.log('\nCaught exception: ' + e)
            console.log('While sneing', elm)
            if (e instanceof RpcError) {
                console.log(JSON.stringify(e.json, null, 2))
            }
        }
    }
}

run()
