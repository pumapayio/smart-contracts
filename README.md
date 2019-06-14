
# PumaPay Pull Payment Smart Contracts V2
## V1 Smart Contracts 
You can find the first version of the smart contracts [here](https://github.com/pumapayio/pumapay-token).

## PumaPay Pull Payment Protocol
The PumaPay Pull Payment Protocol supports an advanced "pull" mechanism, which allows users to not only push tokens from one wallet to another but to also pull funds from other wallets after prior authorization has been given.
Our Pull Payment Protocol currently supports a variaty of payments models such as:
* Single Pull Payment
* Recurring Pull Payment (Fixed amount / Fixed period)
* Recurring Pull Payment with initial payment 
* Recurring Pull Payment with trial period (free trial)
* Recurring Pull Payment with initial payment and trial period (paid trial)    

The current version of our protocol has a semi-decentralized approach in order to reduced the gas fees that are involved with setting the PMA/Fiat rates on the blockchain and eliminate the customer costs for registering and cancelling pull payments, which are currently taken care of by PumaPay through the smart contract.  
In order for the smart contract to operate correctly, it requires that the smart contract holds ETH which are used for funding the owner address and the executors. 
The smart contract will be monitored and once its balance drops below 2 ETH it will be funded with more ETH.

## PullPayment Contract Documentation
You can find the documentation of our smart contracts here:
* [Pull Payment V1.1 Smart Contract](./docs/Pull%20Payment%20V1.md)
* [Pull Payment V2 Smart Contract](./docs/Pull%20Payment%20V2.md)

## Development
* Contracts are written in [Solidity](https://solidity.readthedocs.io/en/develop/) and tested using [Truffle](http://truffleframework.com/) and [Ganache-cli](https://github.com/trufflesuite/ganache-cli).
* All the smart contracts have been developed based on modules developed by [Open Zepellin](https://openzeppelin.org/).
* Solc Version: 0.5.8 - To update the solc version in truffle use. To use a different solc version update `scripts/solc.sh`
```bash
$ npm run solc-update
```

## Tests
To run the tests you can run 
```bash
$ npm test
```

## Audits
Our smart contracts have been audited by several auditing companies and blockchain experts.   
#### PumaPay Token
Our token was audited by [SmartDec](https://smartdec.net/) and the audit report can be found [here](https://github.com/pumapayio/pumapay-token/blob/master/audits/PumaPay%20Token%20Security%20Audit%20-%20SmartDec.pdf).
#### PumaPay PullPayment V1
Our PullPayment Protocol has been audited by three separete auditing companies - [SmartDec](https://smartdec.net/) and [Hacken](https://hacken.io/) -  to ensure that the desired functionality
and the relevant security is in place on top of the elimination of any bugs and vulnerabilities.
* [Hacken Audit Report](https://github.com/pumapayio/pumapay-token/blob/master/audits/PullPayment%20Smart%20Contract%20-%20Hacken.pdf)
* [SmartDec Audit Report](https://github.com/pumapayio/pumapay-token/blob/master/audits/PullPayment%20Smart%20Contract%20-%20SmartDec.pdf)

#### PumaPay PullPayment V2
The V2 of the smart contracts are currently under auditing. 
The updated reports will be uploaded to the repository once the auditing process is finished.
