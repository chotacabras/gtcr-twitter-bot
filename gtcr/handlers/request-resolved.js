const { ITEM_STATUS } = require('../../utils/enums')
const { capitalizeFirstLetter } = require('../../utils/string')
const { networks } = require('../../utils/networks')

module.exports = ({
  tcr,
  tcrMetaEvidence,
  twitterClient,
  bitly,
  db,
  network
}) => async (_itemID, _requestIndex, _roundIndex, _disputed, _resolved) => {
  if (_disputed || !_resolved) return // Only handle request executed.

  const {
    metadata: { itemName, tcrTitle }
  } = tcrMetaEvidence
  const [shortenedLink, itemInfo, tweetID] = await Promise.all([
    bitly.shorten(
      `${process.env.GTCR_UI_URL}/tcr/${network.chainId}/${tcr.address}/${_itemID}`
    ),
    tcr.getItemInfo(_itemID),
    db.get(`${network.chainId}-${tcr.address}-${_itemID}`)
  ])

  const { status } = itemInfo
  const message = `${
    status === ITEM_STATUS.REGISTERED
      ? `${capitalizeFirstLetter(itemName)} accepted into the`
      : `${capitalizeFirstLetter(itemName)} removed from the`
  } ${tcrTitle} List in ${networks[network.chainId].name}.
    \n\nListing: ${shortenedLink}`

  console.info(message)

  if (twitterClient) {
    const tweet = await twitterClient.post('statuses/update', {
      status: message,
      in_reply_to_status_id: tweetID,
      auto_populate_reply_metadata: true
    })

    await db.put(`${network.chainId}-${tcr.address}-${_itemID}`, tweet.id_str)
  }
}
