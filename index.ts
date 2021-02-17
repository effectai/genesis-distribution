import fs from 'fs'
import {Api, JsonRpc, RpcError} from 'eosjs'
import csvParse from 'csv-parse'
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

const action = (to: string, amount: number) => {
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
            quantity: amount,
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

    const signatureProvider = new JsSignatureProvider([privateKey])
    const rpc = new JsonRpc(eosNode, {fetch})
    const api = new Api({rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder()})

    try {
        const result = await api.transact({actions: actions})
        console.dir(result)
    } catch (e) {
        console.log('\nCaught exception: ' + e)
        if (e instanceof RpcError) {
            console.log(JSON.stringify(e.json, null, 2))
        }
    }
}

run()
