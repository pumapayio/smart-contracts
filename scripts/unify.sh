#!/usr/bin/env bash

# Exit script as soon as a command fails.
set -o errexit

read -p "Which smart contract you want to unify? " smartcontract

read -p "Unified file name? " unifiedfname

echo "Cleaning existing unified file unified/$unifiedfname.sol"
echo '' > unified/$unifiedfname.sol
echo "------------------------------"

read -p "Is it located in a subdirectory in contracts  (y/n) ? " answer
case ${answer:0:1} in
y | Y)
  read -p "Which subdirectory is it located? " subdirectory
  echo "------------------------------"
  echo "Smart contract in contracts subdir: $subdirectory/$smartcontract.sol --> unified/$unifiedfname.sol"
  echo "------------------------------"
  node_modules/.bin/truffle-flattener contracts/$subdirectory/$smartcontract.sol >> unified/$unifiedfname.sol
  ;;
*)
  echo "------------------------------"
  echo "Smart contract in contracts root dir contracts/$smartcontract --> unified/$unifiedfname.sol"
  echo "------------------------------"
  node_modules/.bin/truffle-flattener contracts/$smartcontract.sol >> unified/$unifiedfname.sol
  ;;
esac

exit 0
