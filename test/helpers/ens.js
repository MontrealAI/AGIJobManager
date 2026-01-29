const { soliditySha3, keccak256, toBN } = web3.utils;

function rootNode(label) {
  return soliditySha3({ type: "string", value: label });
}

function subnode(root, subdomain) {
  const labelHash = keccak256(subdomain);
  return soliditySha3({ type: "bytes32", value: root }, { type: "bytes32", value: labelHash });
}

async function setNameWrapperOwnership(nameWrapper, root, subdomain, owner) {
  const node = subnode(root, subdomain);
  await nameWrapper.setOwner(toBN(node), owner);
  return node;
}

async function setResolverOwnership(ens, resolver, root, subdomain, owner) {
  const node = subnode(root, subdomain);
  await ens.setResolver(node, resolver.address);
  await resolver.setAddr(node, owner);
  return node;
}

module.exports = {
  rootNode,
  subnode,
  setNameWrapperOwnership,
  setResolverOwnership,
};
