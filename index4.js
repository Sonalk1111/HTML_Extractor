import dotenv from "dotenv"

dotenv.config()

/// ------------

import { fetchDisbursments, fetchDisbursmentDetails } from "./disbursments.js"
import { getShipmentInvoice, extractShipmentData, get_Commision_Obj, get_Commision, pageCount, extractShipmentData_Commison } from "./Shipments_swastik.js"
import { from, of, toArray, range, empty } from 'ix/asynciterable/index.js';
import { map, take, flatMap, filter, tap, groupBy, expand } from 'ix/asynciterable/operators/index.js';
import fs from "fs";

fs.writeFileSync("./result1.csv","marketplace\tmarketplace_transaction_id\torder_id\tmarketplace_sku\ttransaction_amount\ttransaction_type\ttransaction_date\ttransaction_group\tremark\tshipment_id\tquantity\tigst\tcgst\tsgst\ttcs_igst\ttcs_cgst\ttcs_sgst\ttds\n")


const program = from(fetchDisbursments('2023-01-01', '2023-01-31')).pipe(
  // take(1),
    flatMap(ids => ids),
    // take(1),
    // filter((x) => x.accountable_number.includes('6468674516')),
    flatMap((disbursment) => {
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
                          map(async v => (
                            // console.log(v),
                            {
                            shipmentId: v.key,
                            details_ship: await toArray(v),
                            // tcs: v.accountable_type == 'tcs' : v.seller_amount.value ? 0
                          })),
                          map((x) => {
                            const tcs = x.details_ship.filter((x) => x.accountable_type.includes('Tcs')).flatMap((x) => {return x.seller_amount.value})
                            const tds = x.details_ship.filter((x) => x.accountable_type.includes('Section194OTds')).flatMap((x) => {return x.seller_amount.value})
                            return{
                                ...x,
                                Tcs: tcs,
                                Tds: tds
                            }
                          }),
                          // take(1),
                        //   filter((x) => x.shipmentId.includes('16478545710811784338J')),
                          flatMap(async ({ shipmentId, details_ship, Tcs, Tds }) => {
                            console.log(shipmentId)
                            const arrShipmentDetails = await getShipmentInvoice(shipmentId).then(extractShipmentData)
                            return arrShipmentDetails.map(shipmentDetails => ({
                              shipmentId,
                              Tcs,
                              Tds,
                              details_ship,
                              shipmentDetails,
                            }))
                          })
                        ))
                        // .then((arr) => {
                        //     // console.dir(arr, {depth: null})
                        //     const total = arr.reduce((a,c) => a+(c.shipmentDetails["Transaction Amt"])+(c.shipmentDetails.IGST)+(c.shipmentDetails.CGST)+(c.shipmentDetails.SGST)+ (c.Tcs[0]) + c.Tds[0],0)
                        //     console.log(total)
                        //     return arr
                        // })
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
                          map((x) => {
                            const tcs = x.details_ship.filter((x) => x.accountable_type.includes('Tcs')).flatMap((x) => {return x.seller_amount.value})
                            const tds = x.details_ship.filter((x) => x.accountable_type.includes('Section194OTds')).flatMap((x) => {return x.seller_amount.value})
                            return{
                                ...x,
                                Tcs: tcs,
                                Tds: tds
                            }
                          }),
                           //   filter((x) => x.shipmentId.includes('16509464910981465206J')),
                          flatMap(async ({ shipmentId, details_ship, Tcs, Tds}) => {
                            console.log(shipmentId)
                            const arrShipmentDetails = await getShipmentInvoice(shipmentId).then(extractShipmentData)
                            // console.log(arrShipmentDetails)
                            return arrShipmentDetails.map(shipmentDetails => ({
                              shipmentId,
                              Tcs,
                              Tds,
                              details_ship,
                              shipmentDetails
                            }))
                          })
                        ))
                        // .then((arr) => {
                        //     // console.log(arr)
                        //     const total = arr.reduce((a,c) => a+(-c.shipmentDetails["Transaction Amt"])+(-c.shipmentDetails.IGST)+(-c.shipmentDetails.CGST)+(-c.shipmentDetails.SGST)+(c.Tcs[0]),0)
                        //     console.log(total)
                        //     return arr
                        // })
                      }
                    } 
                    else if (g.key === 'Service Invoice') {
                      // console.log(g)
                      return {
                        type: g.key,
                        details_ship: await toArray(from(g).pipe(
                            map(async (x) => (
                              {
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
                                  }
                                )),
                                map(async (x)=> {
                                    const shipmentDetails = await getShipmentInvoice(x.shipmentId).then(extractShipmentData_Commison)
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
                                  const shipmentDetails = await getShipmentInvoice(x.shipmentId).then(extractShipmentData_Commison)
                                  return {
                                    ...x,
                                    shipmentDetails
                                  }
                                })
                                ),
                              )
                            }
                          )),
                        //   map((x) => {
                        //     // console.log(x.prepaid)
                        //     const cal_total_prepaid = x.prepaid.reduce((a,c) => a + c.total_with_st, 0)
                        //     const prepaid_total = x.prepaid.reduce((a,c) => {
                        //        const t = a + (!!c.commission_fee_charge ? c.commission_fee_charge : 0) + (!!c.commission_fee_service_tax ? c.commission_fee_service_tax: 0) + (!!c.fixed_fee_charge ? c.fixed_fee_charge : 0) + (!!c.fixed_fee_service_tax? c.fixed_fee_service_tax: 0) + (!!c.collection_fee_charge ? c.collection_fee_charge : 0) + (!! c.collection_fee_service_tax? c.collection_fee_service_tax : 0) + (!!c.forward_logistics_fee_charge ? c.forward_logistics_fee_charge : 0) + (!!c.forward_logistics_fee_service_tax? c.forward_logistics_fee_service_tax: 0) + (!!c.shipping_delay_penalty_fee_charge ? c.shipping_delay_penalty_fee_charge : 0) + (!!c.shipping_delay_penalty_fee_service_tax ? c.shipping_delay_penalty_fee_service_tax : 0 )+ (!!c.reverse_logistics_fee_charge ? c.reverse_logistics_fee_charge : 0) + (!!c.reverse_logistics_fee_service_tax ? c.reverse_logistics_fee_service_tax: 0)
                        //        return t
                        //     }, 0)
                        //     const cal_total_cod = x.cod.reduce((a,c) => a + c.total_with_st, 0)
                        //     const cod_total = x.cod.reduce((a,c) => {
                        //         const t = a + (!!c.commission_fee_charge ? c.commission_fee_charge : 0) + (!!c.commission_fee_service_tax ? c.commission_fee_service_tax: 0) + (!!c.fixed_fee_charge ? c.fixed_fee_charge : 0) + (!!c.fixed_fee_service_tax? c.fixed_fee_service_tax: 0) + (!!c.collection_fee_charge ? c.collection_fee_charge : 0) + (!! c.collection_fee_service_tax? c.collection_fee_service_tax : 0) + (!!c.forward_logistics_fee_charge ? c.forward_logistics_fee_charge : 0) + (!!c.forward_logistics_fee_service_tax? c.forward_logistics_fee_service_tax: 0) + (!!c.shipping_delay_penalty_fee_charge ? c.shipping_delay_penalty_fee_charge : 0) + (!!c.shipping_delay_penalty_fee_service_tax ? c.shipping_delay_penalty_fee_service_tax : 0 )+ (!!c.reverse_logistics_fee_charge ? c.reverse_logistics_fee_charge : 0) + (!!c.reverse_logistics_fee_service_tax ? c.reverse_logistics_fee_service_tax: 0)
                        //         return t
                        //      }, 0)
                        //     console.log(cal_total_prepaid, prepaid_total)
                        //     console.log(cal_total_cod, cod_total)
                        //     return x
                        //   })
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

// let documents = []

program.forEach(d => {
    // console.log(d)
//   fs.appendFileSync("./result1.csv", `\n`)
  fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t \t \t${d.total}\tDisbursement\t${d.transactionDate}\tsettlement\t \t \t \t \t \t \t \t \t \t \n`)
  for (let v of d.details){
      if(v.type === 'Invoice'){
        for(let val of v.details_ship){
        const isIgst = !!val.shipmentDetails.IGST
        // console.log(val.shipmentDetails)
        const TDS = (val.shipmentDetails['Transaction Amt']/100).toFixed(2)
        //   console.log(TDS)
          fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${val.shipmentDetails['Order ID']}\t${val.shipmentDetails['SKU ID']}\t${val.shipmentDetails['Transaction Amt']}\tOrder\t${val.details_ship[0].created_at}\tsale\t \t${val.details_ship[0].shipment_number}\t${val.shipmentDetails.qty}\t${(isIgst ? val.shipmentDetails.IGST : 0)}\t${!isIgst ? val.shipmentDetails.CGST : 0}\t${!isIgst ? val.shipmentDetails.SGST : 0}\t${isIgst ? -TDS : 0}\t${!isIgst ? -TDS / 2 : 0}\t${!isIgst ? -TDS / 2 : 0}\t${-TDS}\n`)
        }
      }
      else if(v.type === 'Return'){
        for(let val of v.details_ship){
            const IGST_amt = val.shipmentDetails.IGST
            const TDS = (val.shipmentDetails['Transaction Amt']/100).toFixed(2)
          const isIgst = !!val.shipmentDetails.IGST
          fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${val.shipmentDetails['Order ID']}\t${val.shipmentDetails['SKU ID']}\t${-val.shipmentDetails['Transaction Amt']}\tReturn\t${(val.details_ship[0].created_at || 0)}\trefund\t \t${(val.details_ship[0].shipment_number || 0)}\t${val.shipmentDetails.qty}\t${isIgst ? -IGST_amt : 0}\t${!isIgst ? - parseFloat(val.shipmentDetails.CGST) : 0}\t${!isIgst ? - parseFloat(val.shipmentDetails.SGST) : 0}\t${isIgst ? TDS : 0 || 0}\t${!isIgst ? TDS / 2 : 0 || 0}\t${!isIgst ? TDS / 2 : 0 || 0}\t0\n`)
        }
      }
      else if(v.type === 'Service Invoice'){
        for(let val of v.details_ship){
            // console.log(val)
          val.prepaid.map(x => {
            // console.log(x)
            if(x.shipmentDetails){
              fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${x.shipmentDetails['Order ID']}\t${x.shipmentDetails['SKU ID']}\t${x.commission_fee_charge}\tSeller_Commision\t${x.date}\tcommision\t${val.document_number} \t${x.shipmentId}\t${x.shipmentDetails.qty}\t${x.commission_fee_service_tax}\t0\t0\t0\t0\t0\t0\n`)
              fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${x.shipmentDetails['Order ID']}\t${x.shipmentDetails['SKU ID']}\t${x.fixed_fee_charge || 0}\tFixed_fee\t${x.date}\tcommision\t ${val.document_number}\t${x.shipmentId}\t${x.shipmentDetails.qty}\t${x.fixed_fee_service_tax || 0}\t0\t0\t0\t0\t0\t0\n`)
              fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${x.shipmentDetails['Order ID']}\t${x.shipmentDetails['SKU ID']}\t${x.collection_fee_charge || 0}\tCollection_fee_charge\t${x.date}\tcommision\t${val.document_number} \t${x.shipmentId}\t${x.shipmentDetails.qty}\t${x.collection_fee_service_tax || 0}\t0\t0\t0\t0\t0\t0\n`)
              fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${x.shipmentDetails['Order ID']}\t${x.shipmentDetails['SKU ID']}\t${x.forward_logistics_fee_charge || 0}\tForward_logistics_fee_charge\t${x.date}\tcommision\t ${val.document_number}\t${x.shipmentId}\t${x.shipmentDetails.qty} \t${x.forward_logistics_fee_service_tax || 0}\t0\t0\t0\t0\t0\t0\n`)
              fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${x.shipmentDetails['Order ID']}\t${x.shipmentDetails['SKU ID']}\t${x.shipping_delay_penalty_fee_charge || 0}\tShipping_delay_penalty_fee_charge\t${x.date}\tcommision\t ${val.document_number}\t${x.shipmentId}\t${x.shipmentDetails.qty}\t${x.shipping_delay_penalty_fee_service_tax|| 0}\t0\t0\t0\t0\t0\t0\n`)
              fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${x.shipmentDetails['Order ID']}\t${x.shipmentDetails['SKU ID']}\t${x.reverse_logistics_fee_charge || 0}\t reverse_logistics_fee_charge\t${x.date}\tcommision\t${val.document_number} \t${x.shipmentId}\t${x.shipmentDetails.qty}\t${x.reverse_logistics_fee_service_tax || 0}\t0\t0\t0\t0\t0\t0\n`)
            
            }
          }) 
          val.cod.map((x) => {
            if(x.shipmentDetails){
                // console.log(x)
              fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${x.shipmentDetails['Order ID']}\t${x.shipmentDetails['SKU ID']}\t${x.commission_fee_charge}\tSeller_Commision\t${x.date}\tcommision\t${val.document_number} \t${x.shipmentId}\t${x.shipmentDetails.qty}\t${x.commission_fee_service_tax}\t0\t0\t0\t0\t0\t0\n`)
              fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${x.shipmentDetails['Order ID']}\t${x.shipmentDetails['SKU ID']}\t${x.fixed_fee_charge || 0}\tFixed_fee\t${x.date}\tcommision\t${val.document_number} \t${x.shipmentId}\t${x.shipmentDetails.qty}\t${x.fixed_fee_service_tax || 0}\t0\t0\t0\t0\t0\t0\n`)
              fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${x.shipmentDetails['Order ID']}\t${x.shipmentDetails['SKU ID']}\t${x.collection_fee_charge || 0}\tCollection_fee_charge\t${x.date}\tcommision\t ${val.document_number}\t${x.shipmentId}\t${x.shipmentDetails.qty}\t${x.collection_fee_service_tax || 0}\t0\t0\t0\t0\t0\t0\n`)
              fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${x.shipmentDetails['Order ID']}\t${x.shipmentDetails['SKU ID']}\t${x.forward_logistics_fee_charge || 0}\tForward_logistics_fee_charge\t${x.date}\tcommision\t${val.document_number} \t${x.shipmentId}\t${x.shipmentDetails.qty} \t${x.forward_logistics_fee_service_tax || 0}\t0\t0\t0\t0\t0\t0\n`)
              fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${x.shipmentDetails['Order ID']}\t${x.shipmentDetails['SKU ID']}\t${x.shipping_delay_penalty_fee_charge || 0}\tShipping_delay_penalty_fee_charge\t${x.date}\tcommision\t${val.document_number} \t${x.shipmentId}\t${x.shipmentDetails.qty}\t${x.shipping_delay_penalty_fee_service_tax|| 0}\t0\t0\t0\t0\t0\t0\n`)
              fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t${x.shipmentDetails['Order ID']}\t${x.shipmentDetails['SKU ID']}\t${x.reverse_logistics_fee_charge || 0}\t reverse_logistics_fee_charge\t${x.date}\tcommision\t ${val.document_number}\t${x.shipmentId}\t${x.shipmentDetails.qty}\t${x.reverse_logistics_fee_service_tax || 0}\t0\t0\t0\t0\t0\t0\n`)
              
            }
          })
        }
      }
      else if(v.type == 'Credit Note'){
        for(let val of v.details_ship){
          let Cred_total = val.seller_amount.value
          fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t \t \t${Cred_total}\tCredit_Note\t${val.created_at}\tadjustment\t${val.accountable_number}\t \t0\t0\t0\t0\t0\t0\t0\t0\n`)  
        }
      }

      else if(v.type == 'Debit Note'){
        for(let val of v.details_ship){
          let Debt_total = val.seller_amount.value
          fs.appendFileSync("./result1.csv", `JIOMART\t${d.transactionId}\t \t \t${Debt_total}\tDebit_Note\t${val.created_at}\tadjustment\t${val.accountable_number}\t \t0\t0\t0\t0\t0\t0\t0\t0\n`)  
        }
      }
    }
    
  })
