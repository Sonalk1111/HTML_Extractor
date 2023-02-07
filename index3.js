import dotenv from "dotenv"

dotenv.config()

/// ------------

import { fetchDisbursments, fetchDisbursmentDetails } from "./disbursments.js"
import { getShipmentInvoice, extractShipmentData, get_Commision_Obj, get_Commision, pageCount } from "./Shipments_swastik.js"
import { from, of, toArray, range, empty } from 'ix/asynciterable/index.js';
import { map, take, flatMap, filter, tap, groupBy, expand } from 'ix/asynciterable/operators/index.js';
import fs from "fs";

fs.writeFileSync("./result1.csv","marketplace\tmarketplace_transaction_id\torder_id\tmarketplace_sku\ttransaction_amount\ttransaction_type\ttransaction_date\ttransaction_group\tremark\tshipment_id\tquantity\tigst\tcgst\tsgst\ttcs_igst\ttcs_cgst\ttcs_sgst\ttds\n")


const program = from(fetchDisbursments('2022-05-01', '2022-05-10')).pipe(
  // take(1),
    flatMap(ids => ids),
    // take(1),
    flatMap((disbursment) => {
        console.log(disbursment.accountable_number)
        return of(disbursment.accountable_number).pipe(
            map(x => from(fetchDisbursmentDetails(x))
            .pipe(
              expand(val => {
                // console.log(val)
                // if (count < 4) {
                //   count = count++
                //   return from(fetchDisbursmentDetails(x, count))
                // }

                // console.log(val)
                const { meta } = val

                // console.log(meta)

                if (meta.pagination.total_count >= meta.pagination.per_page * meta.pagination.page) {
                  // console.log(meta.pagination.page + 1)
                  return from(fetchDisbursmentDetails(x, meta.pagination.page + 1))
                }
                // console.log("sonalllll")
                return empty()
              }),
              flatMap(x => x.result)
              // flatMap(x => {
              //   console.log(x)
              //   return x.pipe(
              //     map(r => r.result)
              //   )
              // })
            )
            // map(x => {
            //   console.log('RESULTSSSSSS', x)
            // })
            ),
            map(async values => {
                const details = await toArray(from(values).pipe(
                  groupBy(val => val.event),
                  map(async g => {
                    var total
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
                          // take(1),
                          flatMap(async ({ shipmentId, details_ship }) => {
                            const arrShipmentDetails = await getShipmentInvoice(shipmentId).then(extractShipmentData)
                            // const val = details_ship.map((x) => {
                            //   const amt = x.seller_amount.value
                            //   // const val = amt.reduce((a,c) => a+c)
                            //   return amt
                            // })
                            // total = val.reduce((a,c) => a+c)
                            // const final_tot = toArray(total)
                            // // amt.seller_amount.value + tcs.seller_amount.value + tds.seller_amount.value)
                            // console.log(final_tot)

                            // const val = details_ship.map(x => {
                            //   return x.seller_amount.value
                            // })
                            // .then((arr) => {
                            //   const total_invoice = arr.reduce((a,c) => a+c, 0)
                            //   console.log(total_invoice)
                            //   return arr
                            // })
                            // total = val.reduce((a,c) => a+c, 0)
                            // console.log(total)

                            // return {
                              // shipmentId,
                              // details_ship,
                              // shipmentDetails
                            // }
                            return arrShipmentDetails.map(shipmentDetails => ({
                              shipmentId,
                              details_ship,
                              shipmentDetails
                            }))
                          }),
                          // tap(({ shipmentDetails, details_ship }) => {
                          //   const total = parseFloat(shipmentDetails['Transaction Amt']) + parseFloat(shipmentDetails['IGST'])
                          // })
                        ))
                        // .then((arr) => {
                        //   const total_invoice = arr.reduce((a,c) => a, c.details_ship.reduce, 0)
                        //   console.log(total_invoice)
                        //   return arr
                        // })
                      }
                    } else if (g.key === 'Return') {
                      // console.log(total)
                      return {
                        type: g.key,
                        details_ship: await toArray(from(g).pipe(
                          groupBy(v => v.shipment_number),
                          map(async v => ({
                            shipmentId: v.key,
                            details_ship: await toArray(v)
                          })),
                          flatMap(async ({ shipmentId, details_ship }) => {
                            const arrshipmentDetails = await getShipmentInvoice(shipmentId).then(extractShipmentData)
                            return arrshipmentDetails.map((shipmentDetails) => ({
                              shipmentId,
                              details_ship,
                              shipmentDetails,
                            }))
                            // const val = details_ship.map(x => {
                            //   return x.seller_amount.value
                            // })
                            // total = val.reduce((a,c) => a+c, 0)
                            // console.log(total)
                            
                          })
                        ))
                      }
                    } 
                    else if (g.key === 'Service Invoice') {
                      // console.log(g)
                      return {
                        type: g.key,
                        details_ship: await toArray(from(g).pipe(
                            map(async (x) => (
                              {
                                // details_ship: await toArray(x),
                                ...x,
                                id: x.accountable_id,
                                total: x.amount.value,
                                pages: await get_Commision_Obj(x.accountable_id).then(pageCount),
                            })),
                            // take(1),
                            map(async (x) => ({
                              ...x,
                              prepaid: await toArray(
                                range(1, x.pages.prepaid).pipe(
                                flatMap(id => get_Commision_Obj(x.id, `p_page=${id}`).then(html => get_Commision(html, "prepaid_table"))),
                                map(async x => ({
                                  ...x,
                                  shipmentId: x.title.toString().match(/\d{20}[A-Z]/g)[0],
                                  // prepaid: await toArray(x)
                                  }
                                )),
                                flatMap(async (x)=> {
                                  const arrshipmentDetails = await getShipmentInvoice(x.shipmentId).then(extractShipmentData)
                                  // console.log(shipmentDetails)
                                  // return {
                                  //   ...x,
                                  //   shipmentDetails
                                  // }
                                  // const array = !!arrshipmentDetails
                                  // console.log(array)
                                  if(arrshipmentDetails){
                                    return arrshipmentDetails.map((shipmentDetails) => ({
                                      ...x,
                                      shipmentDetails,
                                    }))
                                  }

                                  // if(arrshipmentDetails){
                                  //   return arrshipmentDetails.map((shipmentDetails) => ({
                                  //     ...x,
                                  //     shipmentDetails,
                                  //   }))
                                  //   // else{
                                  //   //   return {
                                  //   //     ...x,
                                  //   //     arrshipmentDetails
                                  //   //   }
                                  //   // }
                                  // }
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
                                flatMap(async x=> {
                                  // console.log(x.shipmentId)
                                  const arrshipmentDetails = await getShipmentInvoice(x.shipmentId).then(extractShipmentData)
                                  
                                  // const array = !!arrshipmentDetails
                                  if(arrshipmentDetails){
                                    return arrshipmentDetails.map((shipmentDetails) => ({
                                      ...x,
                                      shipmentDetails,
                                    }))
                                  }
                                })
                                ),
                              )
                            }
                          )),
                          // map((x) => {
                          //   const cal_total_prepaid = x.prepaid.reduce((a,c) => a + c.total_with_st, 0)
                          //   const cal_total_cod = x.cod.reduce((a,c) => a + c.total_with_st, 0)
                          //   // if(x.seller_amount.value == cal_total_cod + cal_total_prepaid){
                          //   //   console.log("sonalllll")
                          //   // }else{
                          //   //   console.log("kkkkkk")
                          //   //   console.log(Math.round(x.seller_amount.value), Math.round(cal_total_cod+cal_total_prepaid))
                          //   // }
                          //   // try {
                          //   //   if(Math.round(x.seller_amount.value) != Math.round(cal_total_cod + cal_total_prepaid)){
                          //   //     throw new Error('calculated total in service Invoice not matched')
                          //   //   }
                          //   // }catch(err){
                          //   //   console.log(err)
                          //   // }
                          //   // return x
                          // })
                        )),
                      }
                    }
                    else if (g.key === 'Credit Note'){
                      return {
                        type: g.key,
                        details_ship: await toArray(from(g).pipe(
                          map((x) => {
                            // const cred_total = x.seller_amount.value
                            // console.log(x)
                            return x
                          })
                        )).then(arr => {
                          // console.log(arr)
                          // const cred_total = arr.reduce((a,c) => a + c.seller_amount.value, 0)
                          // console.log(cred_total)
                          return arr
                        })
                      }
                    }

                    else if(g.key === 'Debit Note'){
                      return {
                        type: g.key,
                        details_ship: await toArray(from(g).pipe(
                          map((x) => {
                            // const debt_total = x.seller_amount.value
                            return x
                          })
                          // .then(arr => {
                          //   const debt_total = arr.reduce((a,c) => a + c.seller_amount.value, 0)
                          //   return arr
                          // })
                        ))
                      }
                    }
                  })
                ))
                // const total = cred_total + debt_total
                // const total = details.reduce((a,c) => a + console.log(c.details_ship[0].seller_amount), 0)
                // console.log(total)
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
  // console.log(d)
  // console.dir(d, { depth : null })
  fs.appendFileSync("./result1.csv", `\n`)
  fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t \t \t${d.total}\tDisbursement\t${d.transactionDate}\t \t \t \t \t \t \t \t \t \t \t \n`)
  for (let v of d.details){
      if(v.type === 'Invoice'){
        for(let val of v.details_ship){
          // console.log(val)
          const isIgst = !!val.shipmentDetails.IGST
          // const TDS = val.details_ship[1].seller_amount.value ? val.shipmentDetails['Transaction Amt']/100 : 0
          // if(val.shipmentDetails.qty>2){

          // }
          const TDS = (val.shipmentDetails['Transaction Amt']/100).toFixed(2)
          fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${val.shipmentDetails['Order ID']}\t${val.shipmentDetails['SKU ID']}\t${val.shipmentDetails['Transaction Amt']}\tOrder\t${val.details_ship[0].created_at}\tsale\t \t${val.details_ship[0].shipment_number}\t${val.shipmentDetails.qty}\t${(isIgst ? val.shipmentDetails.IGST : 0)}\t${!isIgst ? val.shipmentDetails.CGST : 0}\t${!isIgst ? val.shipmentDetails.SGST : 0}\t${isIgst ? -TDS : 0}\t${!isIgst ? val.details_ship[1].seller_amount.value / 2 : 0}\t${!isIgst ? val.details_ship[1].seller_amount.value / 2 : 0}\t${-TDS}\n`)
        }
      }
      else if(v.type === 'Return'){
        // console.log(v.details_ship.details_ship)
        for(let val of v.details_ship){
          // console.log(val)
          const isIgst = !!val.shipmentDetails.IGST
          fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${val.shipmentDetails['Order ID']}\t${val.shipmentDetails['SKU ID']}\t${-val.shipmentDetails['Transaction Amt']}\tReturn\t${(val.details_ship[0].created_at || 0)}\tRefund\t \t${(val.details_ship[0].shipment_number || 0)}\t${val.shipmentDetails.qty}\t${isIgst ? -val.shipmentDetails.IGST : 0}\t${!isIgst ? -val.shipmentDetails.CGST : 0}\t${!isIgst ? -val.shipmentDetails.SGST : 0}\t${isIgst ? val.details_ship[1].seller_amount.value : 0 || 0}\t${!isIgst ? val.details_ship[1].seller_amount.value / 2 : 0 || 0}\t${!isIgst ? val.details_ship[1].seller_amount.value / 2 : 0 || 0}\t0\n`)
        }
      }
      else if(v.type === 'Service Invoice'){
        // console.log()
        for(let val of v.details_ship){
          // console.log(val)
          val.prepaid.map(x => {
            console.log(x)
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
            console.log(x)
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
