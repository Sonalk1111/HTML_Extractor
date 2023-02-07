import dotenv from "dotenv"

dotenv.config()

/// ------------

import { fetchDisbursments, fetchDisbursmentDetails } from "./disbursments.js"
import { getShipmentInvoice, extractShipmentData, get_Commision_Obj, get_Commision, pageCount } from "./shipment.js"
import { from, of, toArray, range, empty } from 'ix/asynciterable/index.js';
import { map, take, flatMap, filter, tap, groupBy, expand } from 'ix/asynciterable/operators/index.js';
import fs from "fs";

fs.writeFileSync("./result1.csv","marketplace\tmarketplace_transaction_id\torder_id\tmarketplace_sku\ttransaction_amount\ttransaction_type\ttransaction_date\ttransaction_group\tremark\tshipment_id\tquantity\tigst\tcgst\tsgst\ttcs_igst\ttcs_cgst\ttcs_sgst\ttds\n")


const program = from(fetchDisbursments('2022-04-01', '2022-04-30')).pipe(
  // take(1),
    flatMap(ids => ids),
    // take(1),
    flatMap((disbursment) => {
        // var count = 1
        console.log(disbursment.accountable_number)
        return of(disbursment.accountable_number).pipe(
          map(x => from(fetchDisbursmentDetails(x))
            .pipe(
              expand(val => {
                const { meta } = val
                if (meta.pagination.total_count >= meta.pagination.per_page * meta.pagination.page) {
                  // console.log(meta.pagination.page + 1)
                  return from(fetchDisbursmentDetails(x, meta.pagination.page + 1))
                }
                return empty()
              }),
              flatMap(x => x.result)
            )
            ),
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
                              shipmentDetails
                            }
                          }),
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
                      // console.log(g)
                      return {
                        type: g.key,
                        details_ship: await toArray(from(g).pipe(
                          // groupBy(v => v.shipment_number),
                            map(async (x) => (
                              {
                                // details_ship: await toArray(x),
                                ...x,
                                id: x.accountable_id,
                                total: x.amount.value,
                                pages: await get_Commision_Obj(x.accountable_id).then(pageCount),
                            })),
                            map(async (x) => ({
                              ...x,
                              prepaid: await toArray(
                                range(1, x.pages.prepaid).pipe(
                                flatMap(id => get_Commision_Obj(x.id, `p_page=${id}`).then(html => get_Commision(html, "prepaid_table"))),
                                map(async x => (
                                  // console.log(x.title),
                                  {
                                  ...x,
                                  shipmentId: x.title.toString().match(/\d{20}[A-Z]/g)[0],
                                  // prepaid: await toArray(x)
                                  }
                                )),
                                map(async (x)=> 
                                  {
                                    // console.log(x.shipmentId)
                                  const shipmentDetails = await getShipmentInvoice(x.shipmentId).then(extractShipmentData)
                                  // console.log(shipmentDetails)
                                  return {
                                    ...x,
                                    shipmentDetails
                                  }
                                })
                              )
                              ),
                              cod: await toArray(
                                range(1, x.pages.cod).pipe(
                                flatMap(id => get_Commision_Obj(x.id, `c_page=${id}`).then(html => get_Commision(html, "cod_table"))),
                                map(x => (
                                  // console.log(x.title),
                                  {
                                  ...x,
                                  shipmentId: x.title.toString().match(/\d{20}[A-Z]/g)[0]
                                })),
                                map(async x=> {
                                  // console.log(x.shipmentId)
                                    const shipmentDetails = await getShipmentInvoice(x.shipmentId).then(extractShipmentData)
                                    // console.log(shipmentDetails)
                                    return {
                                      ...x,
                                      shipmentDetails
                                    }
                                })
                                ),
                              )
                            }
                            )),
                            // map(async (x) => {
                            //   // console.log(x)
                            // })
                            // map((x) => {

                            // })
                            // tap(x => console.dir(x, { depth: null }))
                            // map(async ({res, total, details_ship}) => {
                            //     const commison_details = await get_Commision_Obj(res).then(get_Commision)
                                
                            //     // console.log(total)
                            //     // // console.log(commison_details)
                            //     // const reducedTotal = commison_details.reduce((a, c) => a + c.reduce((ac, cc) => ac + cc.total_with_st, 0), 0)

                            //     // console.log(reducedTotal)

                            //     return{
                            //       details_ship,
                            //       commison_details
                            //       // commison_details: await toArray(from(commison_details.prepaid).pipe(
                            //       //   map( async(x) => {
                            //       //     console.log(x.title)
                            //       //     return {
                                        
                            //       //     }
                            //       //   })
                            //       // ))
                            //       // shipmentDetails
                            //     }
                            // }),
                        )),
                        // map((x))
                      }
                    }
                    else if (g.key === 'Credit Note'){
                      return {
                        type: g.key,
                        details_ship: await toArray(g)
                      }
                    }

                    else if(g.key === 'Debit Note'){
                      return {
                        type: g.key,
                        details_ship: await toArray(g)
                      }
                    }
                  })
                ))

                // const total = disbursment.amount.value
                
                // // console.dir(details, { depth: null })
                // const reducedTotal = details.reduce((a, c) => a + c.details_ship.amount.value, 0)

                // console.log(disbursment.accountable_number)
                return {
                  // details_ship,
                  details,
                  // details_ship,
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

// let documents = []

program.forEach(d => {
  // console.dir(d, { depth : null })
  fs.appendFileSync("./result1.csv", `\n`)
  fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t \t \t${d.total}\tDisbursement\t${d.transactionDate}\t \t \t \t \t \t \t \t \t \t \t \n`)
  for (let v of d.details){
    // console.log(v)
      if(v.type === 'Invoice'){
        for(let val of v.details_ship){
          // console.log(val)
          const isIgst = !!val.shipmentDetails.IGST
          // console.log(val.shipmentDetails['Transaction Amt']*2)
          fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${val.shipmentDetails['Order ID']}\t${val.shipmentDetails['SKU ID']}\t${val.shipmentDetails['Transaction Amt']*val.shipmentDetails.qty || val.shipmentDetails['Transaction Amt']}\tOrder\t${val.details_ship[0].created_at}\tsale\t \t${val.details_ship[0].shipment_number}\t${val.shipmentDetails.qty}\t${(isIgst ? val.shipmentDetails.IGST : 0)*val.shipmentDetails.qty}\t${!isIgst ? val.shipmentDetails.CGST : 0}\t${!isIgst ? val.shipmentDetails.SGST : 0}\t${isIgst ? val.details_ship[1].seller_amount.value : 0}\t${!isIgst ? val.details_ship[1].seller_amount.value / 2 : 0}\t${!isIgst ? val.details_ship[1].seller_amount.value / 2 : 0}\t${val.details_ship[1].seller_amount.value}\n`)
        }
      }
      else if(v.type === 'Return'){
        for(let val of v.details_ship){
          const isIgst = !!val.shipmentDetails.IGST
          // console.log(val.details_ship[1])
          fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${val.shipmentDetails['Order ID']}\t${val.shipmentDetails['SKU ID']}\t${-val.shipmentDetails['Transaction Amt']}\tReturn\t${(val.details_ship[0].created_at || 0)}\tRefund\t \t${(val.details_ship[0].shipment_number || 0)}\t${val.shipmentDetails.qty}\t${isIgst ? -val.shipmentDetails.IGST : 0}\t${!isIgst ? -val.shipmentDetails.CGST : 0}\t${!isIgst ? -val.shipmentDetails.SGST : 0}\t${isIgst ? val.details_ship[1].seller_amount.value : 0 || 0}\t${!isIgst ? val.details_ship[1].seller_amount.value / 2 : 0 || 0}\t${!isIgst ? val.details_ship[1].seller_amount.value / 2 : 0 || 0}\t0\n`)
        }
      }
      else if(v.type === 'Service Invoice'){
        for(let val of v.details_ship){
          // console.log(val)
          val.prepaid.map(x => {
            // console.log(val.created_at)
            if(x.shipmentDetails){
              // console.log(x.created_at)
              // console.log(x.shipmentDetails)
              fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${x.shipmentDetails['Order ID']}\t${x.shipmentDetails['SKU ID']}\t${x.commission_fee_charge}\tSeller_Commision\t${x.date}\tCommision\t${val.document_number} \t${x.shipmentId}\t${x.shipmentDetails.qty}\t${x.commission_fee_service_tax}\t0\t0\t0\t0\t0\t0\n`)
              fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${x.shipmentDetails['Order ID']}\t${x.shipmentDetails['SKU ID']}\t${x.fixed_fee_charge || 0}\tFixed_fee\t${x.date}\tCommision\t ${val.document_number}\t${x.shipmentId}\t${x.shipmentDetails.qty}\t${x.fixed_fee_service_tax || 0}\t0\t0\t0\t0\t0\t0\n`)
              fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${x.shipmentDetails['Order ID']}\t${x.shipmentDetails['SKU ID']}\t${x.collection_fee_charge || 0}\tCollection_fee_charge\t${x.date}\tCommision\t${val.document_number} \t${x.shipmentId}\t${x.shipmentDetails.qty}\t${x.collection_fee_service_tax || 0}\t0\t0\t0\t0\t0\t0\n`)
              fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${x.shipmentDetails['Order ID']}\t${x.shipmentDetails['SKU ID']}\t${x.forward_logistics_fee_charge || 0}\tForward_logistics_fee_charge\t${x.date}\tCommision\t ${val.document_number}\t${x.shipmentId}\t${x.shipmentDetails.qty} \t${x.forward_logistics_fee_service_tax || 0}\t0\t0\t0\t0\t0\t0\n`)
              fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${x.shipmentDetails['Order ID']}\t${x.shipmentDetails['SKU ID']}\t${x.shipping_delay_penalty_fee_charge || 0}\tShipping_delay_penalty_fee_charge\t${x.date}\tCommision\t ${val.document_number}\t${x.shipmentId}\t${x.shipmentDetails.qty}\t${x.shipping_delay_penalty_fee_charge|| 0}\t0\t0\t0\t0\t0\t0\n`)
              fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${x.shipmentDetails['Order ID']}\t${x.shipmentDetails['SKU ID']}\t${x.reverse_logistics_fee_charge || 0}\t reverse_logistics_fee_charge\t${x.date}\tCommision\t${val.document_number} \t${x.shipmentId}\t${x.shipmentDetails.qty}\t${x.reverse_logistics_fee_service_tax || 0}\t0\t0\t0\t0\t0\t0\n`)
            
            }
          }) 
          val.cod.map((x) => {
            if(x.shipmentDetails){
              // console.log(x.date)
              // console.log()
              fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${x.shipmentDetails['Order ID']}\t${x.shipmentDetails['SKU ID']}\t${x.commission_fee_charge}\tSeller_Commision\t${x.date}\tCommision\t${val.document_number} \t${x.shipmentId}\t${x.shipmentDetails.qty}\t${x.commission_fee_service_tax}\t0\t0\t0\t0\t0\t0\n`)
              fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${x.shipmentDetails['Order ID']}\t${x.shipmentDetails['SKU ID']}\t${x.fixed_fee_charge || 0}\tFixed_fee\t${x.date}\tCommision\t${val.document_number} \t${x.shipmentId}\t${x.shipmentDetails.qty}\t${x.fixed_fee_service_tax || 0}\t0\t0\t0\t0\t0\t0\n`)
              fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${x.shipmentDetails['Order ID']}\t${x.shipmentDetails['SKU ID']}\t${x.collection_fee_charge || 0}\tCollection_fee_charge\t${x.date}\tCommision\t ${val.document_number}\t${x.shipmentId}\t${x.shipmentDetails.qty}\t${x.collection_fee_service_tax || 0}\t0\t0\t0\t0\t0\t0\n`)
              fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${x.shipmentDetails['Order ID']}\t${x.shipmentDetails['SKU ID']}\t${x.forward_logistics_fee_charge || 0}\tForward_logistics_fee_charge\t${x.date}\tCommision\t${val.document_number} \t${x.shipmentId}\t${x.shipmentDetails.qty} \t${x.forward_logistics_fee_service_tax || 0}\t0\t0\t0\t0\t0\t0\n`)
              fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${x.shipmentDetails['Order ID']}\t${x.shipmentDetails['SKU ID']}\t${x.shipping_delay_penalty_fee_charge || 0}\tShipping_delay_penalty_fee_charge\t${x.date}\tCommision\t${val.document_number} \t${x.shipmentId}\t${x.shipmentDetails.qty}\t${x.shipping_delay_penalty_fee_charge|| 0}\t0\t0\t0\t0\t0\t0\n`)
              fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${x.shipmentDetails['Order ID']}\t${x.shipmentDetails['SKU ID']}\t${x.reverse_logistics_fee_charge || 0}\t reverse_logistics_fee_charge\t${x.date}\tCommision\t ${val.document_number}\t${x.shipmentId}\t${x.shipmentDetails.qty}\t${x.reverse_logistics_fee_service_tax || 0}\t0\t0\t0\t0\t0\t0\n`)
              
            }
          })
        }
      }
      else if(v.type == 'Credit Note'){
        for(let val of v.details_ship){
          // console.log(val)
          let Cred_total = val.seller_amount.value
          fs.appendFileSync("./result1.csv", `JIOMART\tt-id\to-id\tsku_id\t${Cred_total}\tCredit_Note\t${val.created_at}\tCommision\t${val.accountable_number}\t0\t0\t0\t0\t0\t0\t0\t0\t0\n`)  
        }
      }

      else if(v.type == 'Debit Note'){
        for(let val of v.details_ship){
          // console.log(val)
          let Debt_total = val.seller_amount.value
          fs.appendFileSync("./result1.csv", `JIOMART\tt-id\to-id\tsku_id\t${Debt_total}\tDebit_Note\t${val.created_at}\tCommision\t${val.accountable_number}\t0\t0\t0\t0\t0\t0\t0\t0\t0\n`)  
        }
      }
    }
    
  })
  // .catch(console.log)

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