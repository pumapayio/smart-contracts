const Web3 = require('web3');
const web3 = new Web3('http://localhost:8545');

// Retrieving the VRS from the signature - happens on the server side
const getVRS = async (singature) => {
  const sig = singature.slice(2);
  const r = `0x${sig.slice(0, 64)}`;
  const s = `0x${sig.slice(64, 128)}`;
  const v = await web3.utils.toDecimal(sig.slice(128, 130));

  return {
    v,
    r,
    s
  };
};

module.exports = {
  getVRS
};
