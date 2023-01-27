import dotenv from "dotenv"

dotenv.config()

/// ------------

import fetch from "cross-fetch"
import cheerio from "cheerio"

const cookie = process.env.COOKIE

export const getShipmentInvoice = (id) =>
        fetch(`https://seller.jiomart.com/ril_users/api/shipments/get_invoice_data.json?_ln=en&numbers%5B%5D=${id}&print_data=%7B%22print_actions%22:%7B%22invoice%22:true%7D,%22dimension%22:%224x6+inch%22%7D`, {
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
      "Referer": "https://seller.jiomart.com/oms/shipments/invoice?numbers=16735465842201296623J&print_data=%7B%22print_actions%22:%7B%22invoice%22:true%7D,%22dimension%22:%224x6%20inch%22%7D",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    },
    "body": null,
    "method": "GET"
  }).then(r => r.json()).then(s => s.result.shipments[0].invoice_html_content)


export function extractShipmentData(html) {
  const $ = cheerio.load(html); 
  const shipmentInvoice = $('.invoice-td').text();
  const tax_invoice = $('.table-wrapper').text();
  const a = shipmentInvoice.split('\n')
  const b = tax_invoice.split('\n')

  // console.log(b)
  let order_id = a.findIndex((x) => x.match(' Order Id'))
  let shipment_id = a.findIndex((x) => x.match('Shipment Id'))
  let Transaction_date = a.findIndex((x) => x.match('Order Date'))
  let IGST = b.findIndex((x) => x.match('IGST'))
  let CGST = b.findIndex((x) => x.match('CGST'))
  let SGST = b.findIndex((x) => x.match('SGST'))

  let transaction_amt = b.findIndex((x) => x.match('IGST')|| x.match('CGST'))
  // console.log(b[transaction_amt-1])
  let qty = b.findIndex((x) => x.match('Total') && !x.match('Total Value'))
  let sku = b.findIndex((x) => x.match('SKU:') && !x.match('HSN, SKU'))
  let sku_id = b[sku]
  let id = sku_id.split(' ')
  let sku_iddd = id.findIndex((x) => x.match('SKU:'))

  let obj = {
    "Order ID": (a[order_id]+1).trim(),
    "Shipment TD": (a[shipment_id]+1).trim(),
    "Transaction Date": (a[Transaction_date]+1).trim(),
    "Transaction Amt": (b[transaction_amt - 1]).trim().replace('₹', ''),
    "IGST": b[IGST+1].trim().replace('₹', ''),
    "qty": (b[qty+1]).trim(),
    "SKU ID": (id[sku_iddd+1]).slice(0, -1)
  }

  if (obj.IGST == '') {
    obj = Object.assign(obj, { CGST: b[CGST+1].replace('₹', ''), SGST: b[SGST+1].replace('₹', '') });
    delete obj.IGST
  } 

  // console.log(obj)
  return obj
}

export const get_Commision_Obj = (val) =>
  fetch(`https://seller.jiomart.com/admin/bills/show_transaction_details?id=${val}`, {
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
    "Referer": "https://seller.jiomart.com/oms/disbursement/8821694339",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  },
  "body": null,
  "method": "GET"
}).then((x) => x.text());



export function get_Commision(html) {
  const $ = cheerio.load(html);
  var script = $('script').filter(function () {
    return $(this).text().indexOf("var prepaid_table") > -1;
  });
  var variableAssignment = script.text().split('\n')

  const prepaid_table = variableAssignment.findIndex((x) => x.match('prepaid_table'))
  const cod_table = variableAssignment.findIndex((x) => x.match('cod_table'))

  let a = variableAssignment[prepaid_table+3].split(':').slice(1).join(':').slice(0, -1)
  let b = variableAssignment[cod_table+3].split(':').slice(1).join(':').slice(0, -1)
  let prepaid = JSON.parse(a)
  let cod = JSON.parse(b)

  return [prepaid, cod]

}