module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // for more about customizing your Truffle configuration!
  networks: {
    development: {
      host: 'localhost',
      port: 7545,
      network_id: '*',
      gasPrice: 1000000000
    },
    ganache: {
      host: 'localhost',
      port: 8545,
      network_id: '*',
      gas: 8000000,
      gasPrice: 1000000000
    },
    coverage: {
      host: 'localhost',
      network_id: '*',
      port: 8555,
      gas: 8000000,
      gasPrice: 1000000000
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
