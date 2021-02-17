This repo contains the snapshots used for distributing the inital network fees
to Genesis Guardians.

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