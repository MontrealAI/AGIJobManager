const { soliditySha3, keccak256, toBN } = web3.utils;

function namehash(name) {
  let node = "0x" + "00".repeat(32);
  if (!name) return node;
  const labels = name.toLowerCase().split(".").filter(Boolean);
  for (let i = labels.length - 1; i >= 0; i -= 1) {
    node = soliditySha3(
      { type: "bytes32", value: node },
      { type: "bytes32", value: keccak256(labels[i]) }
    );
  }
  return node;
}

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
  namehash,
  rootNode,
  subnode,
  setNameWrapperOwnership,
  setResolverOwnership,
};
