const delay = require('delay')

const { articleFor, truncateETHAddress } = require('../../utils/string')
const { ITEM_STATUS } = require('../../utils/enums')
const { networks } = require('../../utils/networks')

module.exports = ({
  tcr,
  tcrMetaEvidence,
  twitterClient,
  bitly,
  db,
  network,
  provider
}) => async (_arbitrator, evidenceGroupID, party) => {
  // When someone challenges a request with evidence, two handlers would
  // be dispatched simultaneously (Dispute, Evidence).
  // Which can result in the key not being found depending if the
  // evidence executes faster.
  // We work around this with a simple delay.
  await delay(30 * 1000)

  const { _itemID: itemID } = (
    await provider.getLogs({
      ...tcr.filters.RequestEvidenceGroupID(null, null, evidenceGroupID),
      fromBlock: 0
    })
  ).map(log => tcr.interface.parseLog(log))[0].values

  const { status } = await tcr.getItemInfo(itemID)
  const {
    metadata: { itemName, tcrTitle }
  } = tcrMetaEvidence

  const [shortenedLink, tweetID] = await Promise.all([
    bitly.shorten(
      `${process.env.GTCR_UI_URL}/tcr/${network.chainId}/${tcr.address}/${itemID}`
    ),
    db.get(`${network.chainId}-${tcr.address}-${itemID}`)
  ])

  const message = `New evidence has been submitted by ${truncateETHAddress(
    party
  )} on the ${
    status === ITEM_STATUS.REMOVAL_REQUESTED ? 'removal request' : 'submission'
  } of ${articleFor(itemName)} ${itemName} ${
    status === ITEM_STATUS.REMOVAL_REQUESTED ? 'from the' : 'to the'
  } ${tcrTitle} List in ${networks[network.chainId].name}.
      \n\nListing: ${shortenedLink}`

  console.info(message)

  if (twitterClient) {
    const tweet = await twitterClient.post('statuses/update', {
      status: message,
      in_reply_to_status_id: tweetID,
      auto_populate_reply_metadata: true
    })

    await db.put(`${network.chainId}-${tcr.address}-${itemID}`, tweet.id_str)
  }
}
