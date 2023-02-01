import dotenv from "dotenv"

dotenv.config()

/// ------------

import { fetchDisbursments, fetchDisbursmentDetails } from "./disbursments.js"
import { getShipmentInvoice, extractShipmentData, get_Commision_Obj, get_Commision, pageCount } from "./shipment.js"
import { from, of, toArray, range, empty } from 'ix/asynciterable/index.js';
import { map, take, flatMap, filter, tap, groupBy, expand } from 'ix/asynciterable/operators/index.js';
import fs from "fs";

fs.writeFileSync("./result1.csv","marketplace\tmarketplace_transaction_id\torder_id\tmarketplace_sku\ttransaction_amount\ttransaction_type\ttransaction_date\ttransaction_group\tremark\tshipment_id\tquantity\tigst\tcgst\tsgst\ttcs_igst\ttcs_cgst\ttcs_sgst\ttds\n")


const program = from(fetchDisbursments('2022-06-02', '2022-06-02')).pipe(
  take(1),
    flatMap(ids => ids),
    // take(1),
    flatMap((disbursment) => {
        var count = 1
        // const page = 1
        return of(disbursment.accountable_number).pipe(
            flatMap(x => from(fetchDisbursmentDetails(x)).pipe(
              expand(val => {
                // console.log(val)
                // if (count < 4) {
                //   count = count++
                //   return from(fetchDisbursmentDetails(x, count))
                // }

                // console.log(val)
                const { meta, result } = val

                // console.log(result)

                if (meta.pagination.total_count >= meta.pagination.count * meta.pagination.page) {
                  console.log(meta.pagination.page + 1)
                  return of(fetchDisbursmentDetails(x, meta.pagination.page + 1)).pipe(
                    map((x)=> {return x})
                  )
                }
                console.log("sonalllll")
                return of(result)
              })
            )
            ),
            map(async values => {
                const details = await toArray(from(values).pipe(
                  groupBy(val => val.event),
                  // filter(g => g.accountable_number === '5647405857'),
                  // tap(console.log),
                  map(async g => {
                    // console.dir(g, {depth: null})
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
                            // const total = details_ship[0].amount.value
                            // const extractedTotal = 
                            return {
                              shipmentId,
                              details_ship,
                              shipmentDetails
                            }
                          }),
                          // tap(({ shipmentDetails, details_ship }) => {
                          //   const total = parseFloat(shipmentDetails['Transaction Amt']) + parseFloat(shipmentDetails['IGST'])
                          // })
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
                        )),
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
  console.dir(d, { depth : null })
  fs.appendFileSync("./result1.csv", `\n`)
  fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t \t \t${d.total}\tDisbursement\t${d.transactionDate}\t \t \t \t \t \t \t \t \t \t \t \n`)
  for (let v of d.details){
      if(v.type === 'Invoice'){
        for(let val of v.details_ship){
          const isIgst = !!val.shipmentDetails.IGST
          fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${val.shipmentDetails['Order ID']}\t${val.shipmentDetails['SKU ID']}\t${val.shipmentDetails['Transaction Amt']*val.shipmentDetails.qty || val.shipmentDetails['Transaction Amt']}\tOrder\t${val.details_ship[0].created_at}\tsale\t \t${val.details_ship[0].shipment_number}\t${val.shipmentDetails.qty}\t${(isIgst ? val.shipmentDetails.IGST : 0)*val.shipmentDetails.qty}\t${!isIgst ? val.shipmentDetails.CGST : 0}\t${!isIgst ? val.shipmentDetails.SGST : 0}\t${isIgst ? val.details_ship[1].seller_amount.value : 0}\t${!isIgst ? val.details_ship[1].seller_amount.value / 2 : 0}\t${!isIgst ? val.details_ship[1].seller_amount.value / 2 : 0}\t${val.details_ship[1].seller_amount.value}\n`)
        }
      }
      else if(v.type === 'Return'){
        for(let val of v.details_ship){
          const isIgst = !!val.shipmentDetails.IGST
          fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${val.shipmentDetails['Order ID']}\t${val.shipmentDetails['SKU ID']}\t${-val.shipmentDetails['Transaction Amt']}\tReturn\t${(val.details_ship[0].created_at || 0)}\tRefund\t \t${(val.details_ship[0].shipment_number || 0)}\t${val.shipmentDetails.qty}\t${isIgst ? -val.shipmentDetails.IGST : 0}\t${!isIgst ? -val.shipmentDetails.CGST : 0}\t${!isIgst ? -val.shipmentDetails.SGST : 0}\t${isIgst ? val.details_ship[1].seller_amount.value : 0 || 0}\t${!isIgst ? val.details_ship[1].seller_amount.value / 2 : 0 || 0}\t${!isIgst ? val.details_ship[1].seller_amount.value / 2 : 0 || 0}\t0\n`)
        }
      }
      else if(v.type === 'Service Invoice'){
        for(let val of v.details_ship){
          val.prepaid.map(x => {
            if(x.shipmentDetails){
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
    
  }).catch(console.log)
