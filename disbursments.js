import dotenv from "dotenv"

dotenv.config()

/// ------------

import fetch from "cross-fetch"

const cookie = process.env.COOKIE

export const fetchDisbursments = (startDate, endDate) =>
fetch(`https://seller.jiomart.com/ril_users/api/account_ledgers.json?_ln=en&page=1&per_page=50&q%5Baccount_book_type_eq%5D=PayableAccountBook&q%5Baccountable_type_eq%5D=Disbursement&q%5Bcreated_at_gteq%5D=${startDate}+00:00:00&q%5Bcreated_at_lteq%5D=${endDate}+23:59:59`, {
  "headers": {
    "accept": "application/json, text/plain, */*",
    "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
    "cache-control": "no-cache",
    "pragma": "no-cache",
    "sec-ch-ua": "\"Not_A Brand\";v=\"99\", \"Google Chrome\";v=\"109\", \"Chromium\";v=\"109\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "x-requested-with": "XMLHttpRequest",
    cookie,
    "Referer": "https://seller.jiomart.com/oms/accounting/account_ledgers?page=1&per_page=20&filters=%7B%22account_book_type_eq%22:%22PayableAccountBook%22%7D",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  },
  "body": null,
  "method": "GET"
}).then(r => r.json()).then(r => r.result)

// module.exports = fetchDisbursments


export const fetchDisbursmentDetails = (id, page = 1) => fetch(`https://seller.jiomart.com/ril_users/api/account_ledgers.json?_ln=en&page=${page}&per_page=50&q%5Bdisbursement_number_eq%5D=${id}`, {
  "headers": {
    "accept": "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9",
    "sec-ch-ua": "\"Not_A Brand\";v=\"99\", \"Google Chrome\";v=\"109\", \"Chromium\";v=\"109\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "x-requested-with": "XMLHttpRequest",
    "cookie": cookie,
    "Referer": "https://seller.jiomart.com/oms/disbursement/4190608188",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  },
  "body": null,
  "method": "GET"
}).then(r => {
  // console.log(r.json())
  return r.json()
}).catch(console.log)
// .then(r => r.result)
// 

