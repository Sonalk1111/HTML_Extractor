import dotenv from "dotenv"

dotenv.config()

/// ------------

import { fetchDisbursments, fetchDisbursmentDetails } from "./disbursments.js"
import { getShipmentInvoice, extractShipmentData, get_Commision_Obj, get_Commision } from "./shipment.js"
import { from, of, toArray } from 'ix/asynciterable/index.js';
import { map, take, flatMap, filter, tap, groupBy } from 'ix/asynciterable/operators/index.js';
import fs from "fs";

fs.writeFileSync("./result1.csv","marketplace\tmarketplace_transaction_id\torder_id\tmarketplace_sku\ttransaction_amount\ttransaction_type\ttransaction_date\ttransaction_group\tremark\tshipment_id\tquantity\tigst\tcgst\tsgst\ttcs_igst\ttcs_cgst\ttcs_sgst\ttds\n\n\n")

const program = from(fetchDisbursments('2022-12-01', '2022-12-31')).pipe(
    flatMap(ids => ids),
    // take(1),
    flatMap((disbursment) => {
        return of(disbursment.accountable_number).pipe(
            map(fetchDisbursmentDetails),
            map(async values => {
                const details = await toArray(from(values).pipe(
                  groupBy(val => val.event),
                  map(async g => {
                    if (g.key === 'Invoice') {
                      return {
                        type: g.key,
                        details_ship: await toArray(from(g).pipe(
                          groupBy(v => v.shipment_number),
                          map(async v => ({
                            shipmentId: v.key,
                            details_ship: await toArray(v)
                          })),
                          map(async ({ shipmentId, details_ship }) => {
                            const shipmentDetails = await getShipmentInvoice(shipmentId).then(extractShipmentData)
                            return {
                              shipmentId,
                              details_ship,
                              shipmentDetails,
                            }
                          })
                        ))
                      }
                    } else if (g.key === 'Return') {
                      return {
                        type: g.key,
                        details_ship: await toArray(from(g).pipe(
                          groupBy(v => v.shipment_number),
                          map(async v => ({
                            shipmentId: v.key,
                            details_ship: await toArray(v)
                          })),
                          map(async ({ shipmentId, details_ship }) => {
                            const shipmentDetails = await getShipmentInvoice(shipmentId).then(extractShipmentData)
                            return {
                              shipmentId,
                              details_ship,
                              shipmentDetails,
                            }
                          })
                        ))
                      }
                    } else if (g.key === 'Service Invoice') {
                      return {
                        type: g.key,
                        details_ship: await toArray(from(g).pipe(
                            map(async (x) => (
                              // console.log(x),
                              {
                                res: x.accountable_id,
                                details_ship: x,
                                // shipmentId: x.shipment_number
                            })),
                            map(async ({res, details_ship}) => {
                                const commison_details = await get_Commision_Obj(res).then(get_Commision)
                                return{
                                  details_ship,
                                  commison_details
                                  // commison_details: await toArray(from(commison_details.prepaid).pipe(
                                  //   map( async(x) => {
                                  //     console.log(x.title)
                                  //     return {
                                        
                                  //     }
                                  //   })
                                  // ))
                                  // shipmentDetails
                                }
                            }),
                        )),
                        // map((x))
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
        )
    })
)


const shipment = []

program.forEach(d => {
  // console.dir(d, { depth : null })
  fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t \t \t${d.total}\tDisbursement\t${d.transactionDate}\t \t \t \t \t \t \t \t \t \t \t \n\n`)
  for (let v of d.details){
    console.log(v.details_ship)
    for(let val of v.details_ship){
      let market_trans_id = d.transactionId
      // let ship_id = val.shipmentDetails['Order ID']
      if(v.type === 'Invoice'){
        shipment.push(val.shipmentId)
        const isIgst = !!val.shipmentDetails.IGST
        fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${val.shipmentDetails['Order ID']}\t${val.shipmentDetails['SKU ID']}\t${val.shipmentDetails['Transaction Amt']}\tOrder\t${val.details_ship[0].created_at}\tsale\t \t${val.details_ship[0].shipment_number}\t${val.shipmentDetails.qty}\t${isIgst ? val.shipmentDetails.IGST : 0}\t${!isIgst ? val.shipmentDetails.CGST : 0}\t${!isIgst ? val.shipmentDetails.SGST : 0}\t${isIgst ? val.details_ship[1].seller_amount.value : 0}\t${!isIgst ? val.details_ship[1].seller_amount.value / 2 : 0}\t${!isIgst ? val.details_ship[1].seller_amount.value / 2 : 0}\t${val.details_ship[1].seller_amount.value}\n`)
      }
      else if(v.type === 'Return'){
        shipment.push(val.shipmentId)
        const isIgst = !!val.shipmentDetails.IGST
        fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${val.shipmentDetails['Order ID']}\t${val.shipmentDetails['SKU ID']}\t${-val.shipmentDetails['Transaction Amt']}\tReturn\t${(val.details_ship[0].created_at || 0)}\tRefund\t \t${(val.details_ship[0].shipment_number || 0)}\t${val.shipmentDetails.qty}\t${isIgst ? -val.shipmentDetails.IGST : 0}\t${!isIgst ? -val.shipmentDetails.CGST : 0}\t${!isIgst ? -val.shipmentDetails.SGST : 0}\t${isIgst ? val.details_ship[1].seller_amount.value : 0 || 0}\t${!isIgst ? val.details_ship[1].seller_amount.value / 2 : 0 || 0}\t${!isIgst ? val.details_ship[1].seller_amount.value / 2 : 0 || 0}\t0\n`)
      }
      else if(v.type === 'Service Invoice'){
        // console.log(val)
          // let total_amt = val.details.amount
          // console.log(total_amt)
          for(let v1 of val.commison_details){
            // console.log(v1)
            for(let i of v1){
              // console.log(i)
              shipment.map((x) => {
                if(i.title.match(x)){
                  // console.log(x)
                  fs.appendFileSync("./result1.csv", `JIOMART\tt-id\to-id\tsku_id\t${i.commission_fee_charge}\tSeller_Commision\t0\tCommision\t \t${x}\t$0\t${i.commission_fee_service_tax}\t0\t0\t0\t0\t0\t0\n`)
                  fs.appendFileSync("./result1.csv", `JIOMART\tt-id\to-id\tsku_id\t${i.fixed_fee_charge}\tFixed_fee\t0\tCommision\t \t${x}\t$0\t${i.fixed_fee_service_tax}\t0\t0\t0\t0\t0\t0\n`)
                  fs.appendFileSync("./result1.csv", `JIOMART\tt-id\to-id\tsku_id\t${i.collection_fee_charge}\tCollection_fee_charge\t0\tCommision\t \t${x}\t$0\t${i.collection_fee_service_tax}\t0\t0\t0\t0\t0\t0\n`)
                  fs.appendFileSync("./result1.csv", `JIOMART\tt-id\to-id\tsku_id\t${i.forward_logistics_fee_charge}\tForward_logistics_fee_charge\t0\tCommision\t \t${x}\t$0\t${i.forward_logistics_fee_service_tax}\t0\t0\t0\t0\t0\t0\n`)
                  fs.appendFileSync("./result1.csv", `JIOMART\tt-id\to-id\tsku_id\t${i.shipping_delay_penalty_fee_charge}\tShipping_delay_penalty_fee_charge\t0\tCommision\t \t${x}\t$0\t${i.shipping_delay_penalty_fee_charge}\t0\t0\t0\t0\t0\t0\n\n`)
                }
              })      
            }
            // let trans_amt = 
            // fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${val.shipmentDetails['Order ID']}\t${val.shipmentDetails['SKU ID']}\t${val.shipmentDetails['Transaction Amt']}\tReturn\t${val.details_ship[0].created_at}\tRefund\t \t${val.details_ship[0].shipment_number}\t${val.shipmentDetails.qty}\t${isIgst ? val.shipmentDetails.IGST : 0}\t${!isIgst ? val.shipmentDetails.CGST : 0}\t${!isIgst ? val.shipmentDetails.SGST : 0}\t${isIgst ? val.details_ship[1].seller_amount.value : 0}\t${!isIgst ? val.details_ship[1].seller_amount.value / 2 : 0}\t${!isIgst ? val.details_ship[1].seller_amount.value / 2 : 0}\t${val.details_ship[1].seller_amount.value}\n`)
          }
      }
    }
    
  }
  
}).catch(console.log)

// if(v.type === 'Invoice') {
//   for(let val of v.details_ship) {
//     shipment.push(val.shipmentId)
//     // console.log(Order)
    // const isIgst = !!val.shipmentDetails.IGST
    // fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${val.shipmentDetails['Order ID']}\t${val.shipmentDetails['SKU ID']}\t${val.shipmentDetails['Transaction Amt']}\tOrder\t${val.details_ship[0].created_at}\tsale\t \t${val.details_ship[0].shipment_number}\t${val.shipmentDetails.qty}\t${isIgst ? val.shipmentDetails.IGST : 0}\t${!isIgst ? val.shipmentDetails.CGST : 0}\t${!isIgst ? val.shipmentDetails.SGST : 0}\t${isIgst ? val.details_ship[1].seller_amount.value : 0}\t${!isIgst ? val.details_ship[1].seller_amount.value / 2 : 0}\t${!isIgst ? val.details_ship[1].seller_amount.value / 2 : 0}\t${val.details_ship[1].seller_amount.value}\n`)
//   }
// }
// else if(v.type === 'Return'){
//   for(let val of v.details_ship) {
//     shipment2.push(val.shipmentId)
//     // console.log(Order)
    // const isIgst = !!val.shipmentDetails.IGST
    // fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${val.shipmentDetails['Order ID']}\t${val.shipmentDetails['SKU ID']}\t${val.shipmentDetails['Transaction Amt']}\tReturn\t${val.details_ship[0].created_at}\tRefund\t \t${val.details_ship[0].shipment_number}\t${val.shipmentDetails.qty}\t${isIgst ? val.shipmentDetails.IGST : 0}\t${!isIgst ? val.shipmentDetails.CGST : 0}\t${!isIgst ? val.shipmentDetails.SGST : 0}\t${isIgst ? val.details_ship[1].seller_amount.value : 0}\t${!isIgst ? val.details_ship[1].seller_amount.value / 2 : 0}\t${!isIgst ? val.details_ship[1].seller_amount.value / 2 : 0}\t0\n`)
//   }
// }
// else if(v.type === 'Service Invoice'){
  // for(let val of v.details_ship){
  //   let total_amt = val.details.amount
  //   for(let v1 of val.commison_details){
  //     // console.log(v1)
  //     for(let i of v1){
  //       fil_arr = shipment.filter(function(element) {
  //         return shipment2.indexOf(element) === -1;
  //       });
  //       fil_arr.map((x) => {
  //         if(i.title.match(x)){
  //           for(let ch of i._children){
  //             console.log(order__id)
  //             // fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${val.shipmentDetails['Order ID']}\t${val.shipmentDetails['SKU ID']}\t${ch.commission_fee_charge}\tSeller_Commision\t${val.details_ship[0].created_at}\tRefund\t \t${val.details_ship[0].shipment_number}\t${val.shipmentDetails.qty}\t${ch.commission_fee_service_tax}\t0\t0\t0\t0\t0\t0\n`)
  //           }
  //         }
  //       })      
  //     }
  //     // let trans_amt = 
  //     // fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${val.shipmentDetails['Order ID']}\t${val.shipmentDetails['SKU ID']}\t${val.shipmentDetails['Transaction Amt']}\tReturn\t${val.details_ship[0].created_at}\tRefund\t \t${val.details_ship[0].shipment_number}\t${val.shipmentDetails.qty}\t${isIgst ? val.shipmentDetails.IGST : 0}\t${!isIgst ? val.shipmentDetails.CGST : 0}\t${!isIgst ? val.shipmentDetails.SGST : 0}\t${isIgst ? val.details_ship[1].seller_amount.value : 0}\t${!isIgst ? val.details_ship[1].seller_amount.value / 2 : 0}\t${!isIgst ? val.details_ship[1].seller_amount.value / 2 : 0}\t${val.details_ship[1].seller_amount.value}\n`)
  //   }
  // }
// }