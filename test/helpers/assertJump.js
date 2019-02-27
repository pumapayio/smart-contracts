const assertJump = async function (error) {
  assert.isAbove(error.message.search('invalid opcode'), -1, 'Invalid opcode error must be returned');
};

module.exports = {
  assertJump
};