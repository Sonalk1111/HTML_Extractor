import dotenv from "dotenv"

dotenv.config()

/// ------------

import { fetchDisbursments, fetchDisbursmentDetails } from "./disbursments.js"
import { getShipmentInvoice, extractShipmentData, get_Commision_Obj, get_Commision } from "./shipment.js"
import { from, of, toArray } from 'ix/asynciterable/index.js';
import { map, take, flatMap, filter, tap, groupBy } from 'ix/asynciterable/operators/index.js';
import fs from "fs";

const program = from(fetchDisbursments('2022-12-01', '2022-12-31')).pipe(
    flatMap(ids => ids),
    take(1),
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
                        // console.log(g)
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
                        // console.log(g)
                      return {
                        type: g.key,
                        details: await toArray(from(g).pipe(
                          map(async (x) => (
                            // console.log(x),
                            {
                              res: x.accountable_id,
                              details: x,
                              // shipmentId: x.shipment_number
                          })),
                          map(async ({res, details}) => {
                            // console.log(details)
                              const commison_details = await get_Commision_Obj(res).then(get_Commision)
                              return{
                                details,
                                commison_details,
                                // shipmentDetails
                              }
                          })
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

fs.writeFileSync("./results.csv","marketplace\tmarketplace_transaction_id\torder_id\tmarketplace_sku\ttransaction_amount\ttransaction_type\ttransaction_date\ttransaction_group\tremark\tshipment_id\tquantity\tigst\tcgst\tsgst\ttcs_igst\ttcs_cgst\ttcs_sgst\ttds\n")
const shipment = []
let shipment2 = []
let fil_arr
program.forEach(d => {
  console.dir(d, { depth : null })

  // for (let v of d.details){
  //   // console.log(v)
  //   // let order__id = v.details_ship[0].
  //   // val.shipmentDetails
  //   if(v.type === 'Invoice') {
  //     for(let val of v.details_ship) {
  //       shipment.push(val.shipmentId)
  //       // console.log(Order)
  //       const isIgst = !!val.shipmentDetails.IGST
  //       fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${val.shipmentDetails['Order ID']}\t${val.shipmentDetails['SKU ID']}\t${val.shipmentDetails['Transaction Amt']}\tOrder\t${val.details_ship[0].created_at}\tsale\t \t${val.details_ship[0].shipment_number}\t${val.shipmentDetails.qty}\t${isIgst ? val.shipmentDetails.IGST : 0}\t${!isIgst ? val.shipmentDetails.CGST : 0}\t${!isIgst ? val.shipmentDetails.SGST : 0}\t${isIgst ? val.details_ship[1].seller_amount.value : 0}\t${!isIgst ? val.details_ship[1].seller_amount.value / 2 : 0}\t${!isIgst ? val.details_ship[1].seller_amount.value / 2 : 0}\t${val.details_ship[1].seller_amount.value}\n`)
  //     }
  //   }
  //   else if(v.type === 'Return'){
  //     for(let val of v.details_ship) {
  //       shipment2.push(val.shipmentId)
  //       // console.log(Order)
  //       const isIgst = !!val.shipmentDetails.IGST
  //       fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${val.shipmentDetails['Order ID']}\t${val.shipmentDetails['SKU ID']}\t${val.shipmentDetails['Transaction Amt']}\tReturn\t${val.details_ship[0].created_at}\tRefund\t \t${val.details_ship[0].shipment_number}\t${val.shipmentDetails.qty}\t${isIgst ? val.shipmentDetails.IGST : 0}\t${!isIgst ? val.shipmentDetails.CGST : 0}\t${!isIgst ? val.shipmentDetails.SGST : 0}\t${isIgst ? val.details_ship[1].seller_amount.value : 0}\t${!isIgst ? val.details_ship[1].seller_amount.value / 2 : 0}\t${!isIgst ? val.details_ship[1].seller_amount.value / 2 : 0}\t0\n`)
  //     }
  //   }
  //   else if(v.type === 'Service Invoice'){
  //     for(let val of v.details_ship){
  //       let total_amt = val.details.amount
  //       for(let v1 of val.commison_details){
  //         // console.log(v1)
  //         for(let i of v1){
  //           fil_arr = shipment.filter(function(element) {
  //             return shipment2.indexOf(element) === -1;
  //           });
  //           fil_arr.map((x) => {
  //             if(i.title.match(x)){
  //               for(let ch of i._children){
  //                 console.log(order__id)
  //                 // fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${val.shipmentDetails['Order ID']}\t${val.shipmentDetails['SKU ID']}\t${ch.commission_fee_charge}\tSeller_Commision\t${val.details_ship[0].created_at}\tRefund\t \t${val.details_ship[0].shipment_number}\t${val.shipmentDetails.qty}\t${ch.commission_fee_service_tax}\t0\t0\t0\t0\t0\t0\n`)
  //               }
  //             }
  //           })      
  //         }
  //         // let trans_amt = 
  //         // fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${val.shipmentDetails['Order ID']}\t${val.shipmentDetails['SKU ID']}\t${val.shipmentDetails['Transaction Amt']}\tReturn\t${val.details_ship[0].created_at}\tRefund\t \t${val.details_ship[0].shipment_number}\t${val.shipmentDetails.qty}\t${isIgst ? val.shipmentDetails.IGST : 0}\t${!isIgst ? val.shipmentDetails.CGST : 0}\t${!isIgst ? val.shipmentDetails.SGST : 0}\t${isIgst ? val.details_ship[1].seller_amount.value : 0}\t${!isIgst ? val.details_ship[1].seller_amount.value / 2 : 0}\t${!isIgst ? val.details_ship[1].seller_amount.value / 2 : 0}\t${val.details_ship[1].seller_amount.value}\n`)
  //       }
  //     }
  //   }
  // }
  
}).catch(console.log)

