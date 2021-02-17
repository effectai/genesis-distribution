import logging
import csv
import sys
from datetime import datetime

import requests

logger = logging.getLogger(__name__)

node_url = 'https://eos.greymass.com/v1'


def node_request(endpoint, **kwargs):
    req = requests.post(
        url='{}/chain/{}'.format(node_url, endpoint),
        **kwargs
    )

    logger.info('[EOS] {}'.format(req.request.url))
    if req.status_code == 200:
        return req.json()

    return None


def get_staking_details(account_name):
    data = node_request('get_table_rows', json={
        'code': 'efxstakepool',
        'scope': account_name,
        'table': 'stake',
        'json': True
    })

    efx_staked, nfx_staked = 0, 0
    last_claim_age, last_claim_time = 0, datetime.now()
    if data:
        for row in data['rows']:
            if 'EFX' in row['amount']:
                efx_staked = float(row['amount'].replace(' EFX', ''))
                last_claim_time = datetime.strptime(row['last_claim_time'], '%Y-%m-%dT%H:%M:%S')
                last_claim_age = int(row['last_claim_age'])
            elif 'NFX' in row['amount']:
                nfx_staked = float(row['amount'].replace(' NFX', ''))

    return efx_staked, nfx_staked, last_claim_age, last_claim_time


def calculate_stake_age(last_claim_age, last_claim_time):
    stake_age_limit = 1000 * 24 * 3600
    claim_stop_time = datetime.fromtimestamp(1604188799)

    if last_claim_time < claim_stop_time:
        stake_age_limit = 200 * 24 * 3600
        if datetime.now() > claim_stop_time:
            claim_diff = abs(datetime.now() - last_claim_time)
            last_claim_age = min(stake_age_limit, last_claim_age + claim_diff.total_seconds())
            last_claim_time = datetime.now()
            stake_age_limit = 1000 * 24 * 3600

    claim_diff = abs(datetime.now() - last_claim_time)
    return min(stake_age_limit, last_claim_age + claim_diff.total_seconds())


def calculate_power(efx_staked, last_claim_age, last_claim_time):
    stake_age = calculate_stake_age(last_claim_age, last_claim_time)
    return float(efx_staked + float(stake_age / (200 * 24 * 3600) * efx_staked))


def calculate_dao_rank(account_name):
    logger.info('Calculating DAO rank for {}'.format(account_name))

    efx_staked, nfx_staked, last_claim_age, last_claim_time = get_staking_details(account_name)
    power = calculate_power(efx_staked, last_claim_age, last_claim_time)

    requirements = [
        (0, 0),
        (200000, 10000),
        (348326, 15505),
        (606655, 24041),
        (1056569, 37276),
        (1840152, 57797),
        (3204864, 89615),
        (5581687, 138950),
        (9721233, 215443),
        (16930792, 334048),
        (29487176, 517947)
    ]

    current_rank = 0
    for i, (power_required, nfx_stake_required) in enumerate(requirements):
        if power >= power_required and nfx_staked >= nfx_stake_required:
            current_rank = i

    return current_rank


if __name__ == '__main__':
    try:
        node_url = sys.argv[2]
        print('Using node {}'.format(node_url))
    except IndexError:
        print('No node specified, using fallback {}'.format(node_url))

    members = []
    lower_bound = None

    while True:
        members_data = node_request('get_table_rows', json={
            'code': 'theeffectdao',
            'scope': 'theeffectdao',
            'table': 'member',
            'json': True,
            'limit': 100,
            'lower_bound': lower_bound,
        })

        if not members_data:
            break

        members += members_data['rows']
        if not members_data['more']:
            break

        lower_bound = members_data['next_key']

    num_members = len(members)
    print('Found {} DAO members'.format(num_members))

    for i, member in enumerate(members):
        efx_staked, nfx_staked, last_claim_age, last_claim_time = get_staking_details(member['account'])
        power = calculate_power(efx_staked, last_claim_age, last_claim_time)
        members[i] = {**member,
                      'dao_rank': calculate_dao_rank(member['account']),
                      'efx_staked': efx_staked,
                      'nfx_staked': nfx_staked,
                      'power': power}

    if members:
        with open('airdrop.csv', 'w', newline='') as output:
            output = csv.DictWriter(output, fieldnames=members[0].keys())
            output.writeheader()
            output.writerows(members)
