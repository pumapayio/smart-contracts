
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
#### Top Up Pull Payments    
* Top Up Pull Payment with Total Limits
* Top Up Pull Payment with Total Limits and Time-based limits
* Top Up Pull Payment with Total Limits and Expiration time
* Top Up Pull Payment with Total Limits, Time-based limits and Expiration time

The current version of our protocol has a semi-decentralized approach in order to reduced the gas fees that are involved with setting the PMA/Fiat rates on the blockchain and eliminate the customer costs for registering and cancelling pull payments, which are currently taken care of by PumaPay through the smart contract.  
In order for the smart contract to operate correctly, it requires that the smart contract holds ETH which are used for funding the owner address and the executors. 
The smart contract will be monitored and once its balance drops below 2 ETH it will be funded with more ETH.

## PullPayment Contract Documentation
You can find the documentation of our smart contracts here:
* [Pull Payment V1.1 Smart Contract](./docs/Pull%20Payment%20V1.md)
* [Pull Payment V2 Smart Contract](./docs/Pull%20Payment%20V2.md)

## ChangeLog
#### V1.1
The `V1.1` version of our Pull Payment protocol is identical with the `V1.0` smart contract. 
The major differences are the Solidity version which was upgraded to `v0.5.8` and we have 
updated the executor funding amount to `0.5 ETH` instead of `1 ETH`.
 
#### V2.0
The `V2.0` version of our Pull Payment protocol is again identical with the `V1.x` smart contracts.

Two of the major differences are the Solidity version which was upgraded to `v0.5.8` and we have updated the executor funding amount to `0.5 ETH` instead of `1 ETH`.

The other major differences are:

The first pull payment execution happens on pull payment registration. For that reason we are passing the initial conversion rate as a parameter on the registration function. 

On pull payment execution, the conversion rate is also passed as a parameter so that we can calculate the correct amount of the PMA that need to be transferred using the latest rate.
The conversion rate is not stored as a global variable on the smart contract but it’s passed as a parameter either on the registration or on the execution. 

## Development
* Contracts are written in [Solidity](https://solidity.readthedocs.io/en/develop/) and tested using [Truffle](http://truffleframework.com/) and [Ganache-cli](https://github.com/trufflesuite/ganache-cli).
* All the smart contracts have been developed based on modules developed by [Open Zepellin](https://openzeppelin.org/).


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
Our PullPayment Protocol has been audited by two separate auditing companies - [SmartDec](https://smartdec.net/) and [Hacken](https://hacken.io/) -  to ensure that the desired functionality
and the relevant security is in place on top of the elimination of any bugs and vulnerabilities.
* [Hacken Audit Report](https://github.com/pumapayio/pumapay-token/blob/master/audits/PullPayment%20Smart%20Contract%20-%20Hacken.pdf)
* [SmartDec Audit Report](https://github.com/pumapayio/pumapay-token/blob/master/audits/PullPayment%20Smart%20Contract%20-%20SmartDec.pdf)

#### PumaPay PullPayment V2
The upgraded version of our PullPayment Protocol went through auditing by two security companies to ensure the integrity our protocol and 
all the security controls are in place with no bugs or vulnerabilities. 
The companies that have done the auditing are [SmartDec](https://smartdec.net/) and [Electi Consulting](https://electiconsulting.com/).
* [SmartDec Audit Report](https://github.com/pumapayio/smart-contracts/blob/master/audits/PumaPay%20Security%20Audit%20-%20SmartDec.pdf)
* [Electi Consulting Audit Report](https://github.com/pumapayio/smart-contracts/blob/master/audits/PumaPay%20Security%20Audit%20-%Electi.pdf)
