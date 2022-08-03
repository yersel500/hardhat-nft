const { network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")
const { storeImages, storeTokenUriMetadata } = require("../utils/uploadToPinata")

const imagesLocation = "./images/randomNft"

const metadataTemplate = {
  name: "",
  description: "",
  image: "",
  attibutes: [
    {
      trait_type: "Cuteness",
      value: 100,
    },
  ],
}

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts()
  const chainId = network.config.chainId
  let tokenUris = [
    "ipfs://QmUwbdJqELT7d59mUqMYzCZW9NNqztczbi2bkL2qMy2sEZ",
    "ipfs://QmTxZrPybXQDCEddcfExtEcc5qwDZ53RzcZqPgjVajymaY",
    "ipfs://QmTDHTfMfMj6FjKH3hFAETwuhEp33tVbakTiiiHw2KkcKw",
  ]
  // get the IPFS hashes of our images
  if (process.env.UPLOAD_TO_PINATA == "true") {
    tokenUris = await handleTokenUris()
  }

  let vrfCoordinatorV2Address, subscriptionId

  if (developmentChains.includes(network.name)) {
    const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
    vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address
    const tx = await vrfCoordinatorV2Mock.createSubscription()
    const txReceipt = await tx.wait(1)
    subscriptionId = txReceipt.events[0].args.subId
  } else {
    vrfCoordinatorV2Address = networkConfig[chainId].vrfCoordinatorV2
    subscriptionId = networkConfig[chainId].subscriptionId
  }

  log("-------------------------------")
  // await storeImages(imagesLocation)
  const args = [
    vrfCoordinatorV2Address,
    subscriptionId,
    networkConfig[chainId].gasLane,
    networkConfig[chainId].callbackGasLimit,
    tokenUris,
    networkConfig[chainId].mintFee,
  ]

  const randomIpfsNft = await deploy("RandomIpfsNft", {
    from: deployer,
    args: args,
    log: true,
    waitConfirmations: network.config.blockConfirmations || 1,
  })
  log("-------------------------------")
  if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
    log("verifying...")
    await verify(randomIpfsNft.address, args)
  }
}

async function handleTokenUris() {
  tokenUris = []

  const { responses: imageUploadResponses, files } = await storeImages(imagesLocation)
  for (imageUploadResponseIndex in imageUploadResponses) {
    // create metadata
    let tokenUriMetadata = { ...metadataTemplate }
    tokenUriMetadata.name = files[imageUploadResponseIndex].replace(".png", "")
    tokenUriMetadata.description = `An adorable ${tokenUriMetadata.name} pup!`
    tokenUriMetadata.image = `ipfs://${imageUploadResponses[imageUploadResponseIndex].IpfsHash}`
    console.log(`Uploading ${tokenUriMetadata.name}...`)
    // store the JSON to pinata / IPFS
    const metadataUploadResponse = await storeTokenUriMetadata(tokenUriMetadata)
    tokenUris.push(`ipfs://${metadataUploadResponse.IpfsHash}`)
  }
  console.log("Token URIs Uploaded! They are:")
  console.log(tokenUris)
  return tokenUris
}

module.exports.tags = ["all", "randomipfs", "main"]
