import dotenv from "dotenv"

dotenv.config()

/// ------------

import { fetchDisbursments, fetchDisbursmentDetails } from "./disbursments.js"
import { getShipmentInvoice, extractShipmentData } from "./shipment.js"
import { from, of, toArray } from 'ix/asynciterable/index.js';
import { map, take, flatMap, filter, tap, groupBy } from 'ix/asynciterable/operators/index.js';
import fs from "fs";
// import fetch from 'cross-fetch';
// import * as cheerio from 'cheerio';

// .then(console.log)

const program = from(fetchDisbursments('2022-12-01', '2022-12-01')).pipe(
  flatMap(ids => ids),
  take(1),
  flatMap((disbursment) => {
    return of(disbursment.accountable_number).pipe(
      map(fetchDisbursmentDetails), // point-free-style programming
      map(async values => {
        const details = await toArray(from(values).pipe(
          groupBy(val => val.event),
          map(async g => {
            if (g.key === 'Invoice') {
              return {
                type: g.key,
                details: await toArray(from(g).pipe(
                  groupBy(v => v.shipment_number),
                  map(async v => ({
                    shipmentId: v.key,
                    details: await toArray(v)
                  })),
                  map(async ({ shipmentId, details }) => {
                    const shipmentDetails = await getShipmentInvoice(shipmentId).then(extractShipmentData)
                    return {
                      shipmentId,
                      details,
                      shipmentDetails,
                    }
                  })
                ))
              }
            } else if (g.key === 'Return') {
              return {
                type: g.key,
                details: await toArray(g)
              }
            } else if (g.key === 'Service Invoice') {
              return {
                type: g.key,
                details: await toArray(g)
              }
            }
          })
        ))
        return {
          details,
          total: disbursment.amount.value,
          transactionId: disbursment.accountable_number,
          transactionDate: disbursment.created_at,
          type: 'Disbursment',
          group: 'Settlement',
        }
      }),
      // flatMap(({ details, total }) => {
      //   console.log(details, total)
      //   return of(details).pipe(
      //     groupBy(d => d.event),
      //     // tap(console.log),
      //     // map(() => details)
      //     // flatMap((val) => val)
      //   )
      // }),
      // toArray,
      // 
      // map(details => ({
      //   details,
      //   total: disbursment.amount.value
      // }))
    )
  }),
  // tap(console.log)
)

fs.writeFileSync("./result1.csv","marketplace\tmarketplace_transaction_id\torder_id\tmarketplace_sku\ttransaction_amount\ttransaction_type\ttransaction_date\ttransaction_group\tremark\tshipment_id\tquantity\tigst\tcgst\tsgst\ttcs_igst\ttcs_cgst\ttcs_sgst\ttds\n")

program.forEach(d => {
  // const { total, details } = r
  // const calculatedTotal = details.reduce((a, c) => a + c.amount.value, 0)
  // // 
  // if (calculatedTotal + total > 0.8) {
  //   console.log("MISMATCH", calculatedTotal, total)
  // } else {
  //   console.log("Yaya", calculatedTotal, total)
  // }
  console.dir(d, { depth : null })
  // fs.appendFileSync("./results.tsv", `JIOMART\t${d.transactionId}\t \t \t${d.total}\t${d.type}\t${d.transactionDate}\t${d.group}\n`)

  for (let v of d.details) {
    if (v.type === 'Invoice') {
      for (let val of v.details) {
        const isIgst = !!val.shipmentDetails.IGST
        fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${val.shipmentDetails['Order ID']}\t${val.shipmentDetails['SKU ID']}\t${val.shipmentDetails['Transaction Amt']}\tOrder\t${val.details[0].created_at}\tsale\t \t${val.details[0].shipment_number}\t${val.shipmentDetails.qty}\t${isIgst ? val.shipmentDetails.IGST : 0}\t${!isIgst ? val.shipmentDetails.CGST : 0}\t${!isIgst ? val.shipmentDetails.SGST : 0}\t${isIgst ? val.details[1].seller_amount.value : 0}\t${!isIgst ? val.details[1].seller_amount.value / 2 : 0}\t${!isIgst ? val.details[1].seller_amount.value / 2 : 0}\t${val.details[1].seller_amount.value}\n`)
      }
    }
  }
}).catch(console.log)


// let cookie = '_sellow_session=acfc54dc93342729bf263dd9c57e8efc'
// //  shipment object using iterables


// // shipment object of pdf data

// const shipment_obj2 = (val) => 
//  fetch(`https://seller.jiomart.com/ril_users/api/account_ledgers.json?_ln=en&page=1&per_page=20&q%5Bdisbursement_number_eq%5D=${val}`, {
//   "headers": {
//     "accept": "application/json, text/plain, */*",
//     "accept-language": "en-US,en;q=0.9",
//     "sec-ch-ua": "\"Not_A Brand\";v=\"99\", \"Google Chrome\";v=\"109\", \"Chromium\";v=\"109\"",
//     "sec-ch-ua-mobile": "?0",
//     "sec-ch-ua-platform": "\"Windows\"",
//     "sec-fetch-dest": "empty",
//     "sec-fetch-mode": "cors",
//     "sec-fetch-site": "same-origin",
//     "x-requested-with": "XMLHttpRequest",
//     "cookie": "_sellow_session=acfc54dc93342729bf263dd9c57e8efc",
//     "Referer": "https://seller.jiomart.com/oms/disbursement/5647405857",
//     "Referrer-Policy": "strict-origin-when-cross-origin"
//   },
//   "body": null,
//   "method": "GET"
// });

//   //shippment IDSSSSSSSSSSS


// function get_tcs_tds(y) {
//   // console.log(y)
//   const obj1 = {
//     "TCS": y[0].value,
//     "TDS": y[0].value,
//     "Shipment_ID": y[1]
//   }

//   return obj1
// }



// // extracting tcs tds
// const results = from(jsonData).pipe(
//   map((data) => {
//     if(data.Event == 'Disbursement'){
//       return data.Accountable_Number
//     }
//   }),
//   filter((data) => {
//     return data
//   }),
//   map((x) => {
//     return shipment_obj2(x)
//   }),
//   map((x) => {return x.json()}),
//     // //extacting tcs tds
//     map((data) => {
//       const req_data = data.result
//       return req_data
//     }),
//     flatMap((data) => data),
//     // take(1),
//     map((data) => {
//       let a 
//       if(data.accountable_type == 'Tcs' || data.accountable_type == 'Section194OTds'){
//         a = [data.amount,data.shipment_number]
//       }
//       return a
//     }),
//     filter((x) => x),
//     map((x) => {
//       return x.map(y => y)
//     }),
//     // take(1),
//     map((x) => {
//       return get_tcs_tds(x)
//     })

    
//   );

// // extracting pdf data
//   const result2 = from([
//     ""
//   ]).pipe(
//     // map((data) => {
//     //   if(data.Event == 'Disbursement'){
//     //     return data.Accountable_Number
//     //   }
//     // }),
//     // filter((data) => {
//     //   return data
//     // }),
//     map((x) => {
//       return shipment_obj(x)
//     }),
//     map((x) => {return x.json()}),
//     map((data) => {
//       const req_data = data.result
//       return req_data
//     }),
//     map((data) => {
//       let y = data.map((x) => {return x.shipment_number})
//       let uniqueChars = [...new Set(y)];
//       return uniqueChars.filter((x) => x)
//     }),
//     flatMap(data => data),
//     map(shipment_obj1),
//     map((x) => {return x.json()}),
//     // take(1), 
//     map(x => {
//       let y = x.result.shipments[0]
//       return y
//     }),
//     filter((x) => {
//       return x
//     }),
//     map((x) => {
//       return x.invoice_html_content
//     }),
//     // [0].invoice_html_content
//     map((y) => {
//       return get_data(y)
//     })
   
//   )

//   const json_data = []
  
//   for await (let item of results) {
//     console.dir(item, {depth: null});
//     // json_data.push(item)
//   }

