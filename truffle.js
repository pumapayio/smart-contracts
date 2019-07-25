module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // for more about customizing your Truffle configuration!
  networks: {
    development: {
      host: 'localhost',
      port: 7545,
      network_id: '*', // Match any network id,
      gasPrice: 1000000000  // <-- Use this low gas price
    },
    ganache: {
      host: 'localhost',
      port: 8545,
      network_id: '*',
      gas: 6721975,
      gasPrice: 1000000000
    },
    coverage: {
      host: 'localhost',
      network_id: '*',
      port: 8545,         // <-- If you change this, also set the port option in .solcover.js.
      gas: 0xfffffffffff, // <-- Use this high gas value
      gasPrice: 0x01      // <-- Use this low gas price
    }
  },
  mocha: {
    useColors: true,
    slow: 30000,
    bail: true
  },
  compilers: {
    solc: {
      version: '0.5.10'
    }
  }
};
