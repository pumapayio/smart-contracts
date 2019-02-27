const {assertRevert} = require('./helpers/assertRevert');
const Web3 = require('web3');
const web3 = new Web3('http://localhost:7545');

const BigNumber = web3.BigNumber;
require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

const PumaPayToken = artifacts.require('PumaPayToken');


contract('PumaPayToken', async (accounts) => {

  const oneEth = web3.utils.toWei('1', 'ether');

  const minter = accounts[ 0 ];
  const notMinter = accounts[ 9 ];
  const userOne = accounts[ 1 ];
  const userTwo = accounts[ 2 ];

  let token;

  beforeEach('Deploying new PumaPayToken', async () => {
    token = await PumaPayToken.new({from: minter});
  });

  describe('Deploying', async () => {
    it('Token name should be PumaPay', async () => {
      let tokenName = await token.name.call();

      assert.equal(tokenName.toString(), 'PumaPay');
    });
    it('Token symbol should be PMA', async () => {
      let symbol = await token.symbol.call();

      assert.equal(symbol.toString(), 'PMA');
    });
    it('Decimals is set to 18', async () => {
      let decimals = await token.decimals.call();

      assert.equal(decimals.toNumber(), 18);
    });
    it('Initial total supply is empty', async () => {
      let totalSupply = await token.totalSupply.call();

      assert.equal(totalSupply.toNumber(), 0);
    });
  });

  describe('Minting functionality', async () => {
    it('Minter can mint', async () => {
      await token.mint(userOne, oneEth, {
        from: minter
      });
    });
    it('Rejects notMinter from minting', async () => {
      await assertRevert(token.mint(userOne, oneEth, {
        from: notMinter
      }));
    });
    it('Minting is cumulative', async () => {
      // userOne initial balance is 0
      const initialBalance = await token.balanceOf.call(userOne);

      // Minting 10**18 PMA to userOne
      await token.mint(userOne, oneEth, {
        from: minter
      });
      const afterFirstMinting = await token.balanceOf.call(userOne);

      // Minting another 10**18 PMA to userOne
      await token.mint(userOne, oneEth, {
        from: minter
      });

      const afterSecondMinting = await token.balanceOf.call(userOne);

      assert.equal(initialBalance.toNumber(), 0);
      String(afterFirstMinting).should.be.equal(String(oneEth));
      String(afterSecondMinting).should.be.equal(String(2 * oneEth));
    });
  });
  describe('Token functionality after minting stage', async () => {
    beforeEach('Mint some tokens', async () => {
      await token.mint(userOne, oneEth, {
        from: minter
      });
      await token.mint(userTwo, oneEth, {
        from: minter
      });
    });
    it('Can transfer', async () => {
      await token.transfer(userTwo, oneEth, {
        from: userOne
      });
    });
    it('Can approve', async () => {
      await token.approve(userTwo, oneEth, {
        from: userOne
      });
    });
    it('Can transfer from', async () => {
      await token.approve(userTwo, oneEth, {
        from: userOne
      });
      await token.transferFrom(userOne, userTwo, oneEth, {
        from: userTwo
      });
    });
    it('Can increase allowance', async () => {
      await token.increaseAllowance(userTwo, oneEth, {
        from: userOne
      });
    });
    it('Can decrease allowance', async () => {
      await token.approve(userTwo, oneEth, {
        from: userOne
      });
      await token.decreaseAllowance(userTwo, oneEth, {
        from: userOne
      });
    });
  });
});