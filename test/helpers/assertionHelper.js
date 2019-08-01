const assertRevert = async function (promise) {
  try {
    await promise;
    assert.fail('Expected revert not received');
  } catch (error) {
    const revertFound = error.message.search('revert') >= 0;
    assert(revertFound, `Expected "revert", got ${error} instead`);
  }
};

const assertJump = async function (error) {
  assert.isAbove(error.message.search('invalid opcode'), -1, 'Invalid opcode error must be returned');
};

module.exports = {
  assertRevert,
  assertJump
};
