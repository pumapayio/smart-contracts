const transferETH = async (amountInETH, from, to) => {
  await web3.eth.sendTransaction({
    to: to,
    from: from,
    value: web3.utils.toWei(amountInETH.toString(), 'ether')
  });
};

module.exports = {
  transferETH
};


