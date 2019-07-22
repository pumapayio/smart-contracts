const transferETH = async function (numberOfEthers, fromAccount, toAccount) {
  await web3.eth.sendTransaction(
    {
      from: fromAccount,
      to: toAccount,
      value: web3.utils.toWei(String(numberOfEthers), 'ether')
    }
  );
};

const transferTokens = async function (token, numberOfTokens, fromAccount, toAccount) {
  await token.transfer(
    toAccount, web3.utils.toWei(String(numberOfTokens), 'ether'),
    {
      from: fromAccount
    });
};

module.exports = {
  transferETH,
  transferTokens
};