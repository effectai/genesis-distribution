To create an extract of the Guardians at a specific date we first sync a local
EOS node to the corresponding block height and then run a script to extract
staking information from it for each Guardian.

## Sync an EOS node

To sync a local nodeos instance to a specific block height you can download an
EOSIO snapshot just before the required date and cancel the sync a the required
time. After canceling the sync you can remove the P2P nodes from your config
before starting nodeos again.

## Extract Guardian info

This Python script extracts the staking information for Guardians:

```bash
pip install -r requirements.txt
python main.py -node http://127.0.0.1:8888/v1
```