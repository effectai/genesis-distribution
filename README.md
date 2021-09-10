This repo contains the snapshots used for distribution of network fees to Guardians.

# Initial fee distribution

The initial network fees were distributed to genesis guardians

## Snapshot creation

The scripts for creating a snapshot CSV are in the [snapshot](snapshot)
folder. The guardian data at block 158485783 is included in this repo as a CSV.

## Distribution

- Edit `index.ts` and modify the configuration in the top of the file.
- Use the snapshot data to create a "username,amount" distribution CSV.
- Run the script with:

```bash
yarn
yarn start
```

# Network fees 2021

The fees collected in Q1 and Q2 of 2021 can be calculated with the script
`calculate_fees_q1_q2.sh`.
