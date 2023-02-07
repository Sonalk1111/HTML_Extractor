import dotenv from "dotenv"

dotenv.config()

/// ------------

import fetch from "cross-fetch"
import cheerio from "cheerio"

const cookie = process.env.COOKIE

export const getShipmentInvoice = async(id) =>
  {
   const a = await fetch(`https://seller.jiomart.com/ril_users/api/shipments/get_invoice_data.json?_ln=en&numbers%5B%5D=${id}&print_data=%7B%22print_actions%22:%7B%22invoice%22:true%7D,%22dimension%22:%224x6+inch%22%7D`, {
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
  })
  const res = await a.json()
  const result = res.result.shipments[0].invoice_html_content
  return result
  }

export function extractShipmentData(html) {
  // console.log(html)
  if(typeof(html) == 'string'){
    const $ = cheerio.load(html);
    const shipmentInvoice = $('.invoice-td').text();
    // console.log(shipmentInvoice)
    const tax_invoice = $('.table-wrapper').text();
    const a = shipmentInvoice.split('\n')
    // console.log(a)
    const b = tax_invoice.split('\n')
    // console.log(b)
    let order_id = a.findIndex((x) => x.match(' Order Id'))
    let shipment_id = a.findIndex((x) => x.match('Shipment Id'))
    let Transaction_date = a.findIndex((x) => x.match('Order Date'))
    let IGST = []
    let CGST = []
    let SGST = []

    let grand_total = b.findIndex((x) => x.match('Grand Total'))
    let transaction_amt 
    // console.log(b[transaction_amt - 1])
    let qty = b.findIndex((x) => x.match('Total') && !x.match('Total Value'))
    // console.log(b[qty+1])
    let sku_iddd 

    if(b[qty+1] > 1){
        let trans_amt_values = [];
        // let taxable_amt_values = [];
        let SKU_values = [];
        // let CGST_values = [];
        // let SGST_values = [];
        // let HSN_values = [];
        for (let i = 0; i < b.length; i++) {
            if (b[i].includes("IGST")) {
                trans_amt_values.push(b[i - 1].trim().replace('₹', ""));
                IGST.push(b[i + 1].trim().replace("₹", ""));
            }
            if(b[i].includes("CGST")){
                trans_amt_values.push(b[i-1].trim().replace("₹", ""));
                CGST.push(b[i+1].trim().replace("₹", ""));
                SGST.push(b[i+1].trim().replace("₹", ""));
            }
            if(b[i].includes('SKU:')){
                SKU_values.push(b[i].split("SKU:")[1].replace(")", ""))
                // HSN_values.push(b[i].split("SKU:")[1].replace(")", ""))
            }
        }
        transaction_amt = trans_amt_values
        // console.log(trans_amt_values, taxable_amt_values)
        sku_iddd = SKU_values
    }else {
        transaction_amt = b[b.findIndex((x) => x.match('IGST')|| x.match('CGST')) - 1]
        // console.log(transaction_amt, "sonalllllll")
        IGST = b[b.findIndex((x) => x.match('IGST')) + 1]
        let sku = b.findIndex((x) => x.match('SKU:') && !x.match('HSN, SKU'))
        let sku_id = b[sku]
        let id = sku_id.split(' ')
        sku_iddd = id[id.findIndex((x) => x.match('SKU:')) + 1].slice(0, -1)
        CGST = b[b.findIndex((x) => x.match('CGST')) + 1]
        SGST = b[b.findIndex((x) => x.match('SGST')) + 1]
    }

    if (Array.isArray(transaction_amt)) {
       return transaction_amt.map((tr, index) => (
          {
                "Order ID": (a[order_id]+1).trim().slice(0, -1).split(':')[1],
                "Shipment ID": (a[shipment_id]+1).trim().split(':')[1].slice(0, -1),
                "Transaction Date": (a[Transaction_date]+1).trim().slice(0, -1).split(":")[1],
                "Transaction Amt": parseFloat(tr.replace('₹', '').replace(",", "")),
                "IGST": IGST[index] ? parseFloat(IGST[index].replace('₹', '').replace(",", "")) : 0,
                "CGST": !IGST[index] ? parseFloat(CGST[index].replace('₹', "").replace(",", "")) : 0,
                "SGST": !IGST[index] ? parseFloat(SGST[index].replace('₹', "").replace(",", "")) : 0,
                "per_items":  (b[qty+1]).trim()/(b[qty+1]).trim(),
                "qty": (b[qty+1]).trim(),
                "SKU ID": sku_iddd[index],
                "Grand_total": parseFloat(b[grand_total + 1].trim().replace(',', ''))
            }
        ))
    } 
    else {
       var obj = {
            "Order ID": (a[order_id]+1).trim().slice(0, -1).split(':')[1],
            "Shipment ID": (a[shipment_id]+1).trim().split(':')[1].slice(0, -1),
            "Transaction Date": (a[Transaction_date]+1).trim().slice(0, -1).split(":")[1],
            "Transaction Amt": parseFloat(transaction_amt.replace('₹', "").replace(",", "")),
            "IGST": IGST ? parseFloat(IGST.replace('₹', "").replace(",", "")) : 0,
            "CGST": !IGST ? parseFloat(CGST.replace('₹', "").replace(",", "")) : 0,
            "SGST": !IGST ? parseFloat(SGST.replace('₹', "").replace(",", "")): 0,
            "per_items":  1,
            "qty": (b[qty+1]).trim(),
            "SKU ID": sku_iddd,
            "Grand_total": parseFloat(b[grand_total + 1].trim().replace(',', ''))
        }
          // console.log(obj)
        return [obj]
    }
  }
}

export function extractShipmentData_Commison(html) {
  // console.log(html)
  if(typeof(html) == 'string'){
    const $ = cheerio.load(html);
    const shipmentInvoice = $('.invoice-td').text();
    // console.log(shipmentInvoice)
    const tax_invoice = $('.table-wrapper').text();
    const a = shipmentInvoice.split('\n')
    const b = tax_invoice.split('\n')
    
    let order_id = a.findIndex((x) => x.match(' Order Id'))
    let shipment_id = a.findIndex((x) => x.match('Shipment Id'))
    let Transaction_date = a.findIndex((x) => x.match('Order Date'))
    let IGST = b.findIndex((x) => x.match('IGST'))
    let CGST = b.findIndex((x) => x.match('CGST'))
    let SGST = b.findIndex((x) => x.match('SGST'))

    let transaction_amt = b.findIndex((x) => x.match('IGST')|| x.match('CGST'))
    // console.log(b[transaction_amt - 1])
    let qty = b.findIndex((x) => x.match('Total') && !x.match('Total Value'))
    let sku = b.findIndex((x) => x.match('SKU:') && !x.match('HSN, SKU'))
    let sku_id = b[sku]
    let id = sku_id.split(' ')
    let sku_iddd = id.findIndex((x) => x.match('SKU:'))
    
    let obj = {
      "Order ID": (a[order_id]+1).trim().slice(0, -1).split(':')[1],
      "Shipment ID": (a[shipment_id]+1).trim().split(':')[1].slice(0, -1),
      "Transaction Date": (a[Transaction_date]+1).trim().slice(0, -1).split(":")[1],
      "Transaction Amt": (b[transaction_amt - 1]).trim().replace('₹', ''),
      "IGST": b[IGST+1].trim().replace('₹', ''),
      "qty": (b[qty+1]).trim(),
      "SKU ID": (id[sku_iddd+1]).slice(0, -1)
    }
    
    if (obj.IGST == '') {
      obj = Object.assign(obj, { CGST: b[CGST+1].replace('₹', ''), SGST: b[SGST+1].replace('₹', '') });
      delete obj.IGST
    } 
    return obj
  }
}


export const get_Commision_Obj = (val, page = '') =>
  fetch(`https://seller.jiomart.com/admin/bills/show_transaction_details?id=${val}&${page}`, {
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



export function pageCount(x) {
  const html = x.toString()
  const $ = cheerio.load(html);
  const cPages = [];
  const pPages = [];
  $('a').each((i, elem) => {
    const href = $(elem).attr('href');
    const cPage = href.match(/c_page=(\d+)/);
    const pPage = href.match(/p_page=(\d+)/);
    if (cPage) cPages.push(cPage[1]);
    if (pPage) pPages.push(pPage[1]);
  });
  const maxCPage = Math.max(...cPages, 1);
  const maxpPage = Math.max(...pPages, 1);

  return {
    cod: maxCPage,
    prepaid: maxpPage
  }
 
  // return maxPage
}



export function get_Commision(html, table) {
  const $ = cheerio.load(html);
  var script = $('script').filter(function () {
    return $(this).text().indexOf(`var ${table}`) > -1;
  });
  var variableAssignment = script.text().split('\n')

  var tableDetails = variableAssignment.findIndex((x) => x.match(table))
  // console.log(variableAssignment[tableDetails+3])
  return JSON.parse(variableAssignment[tableDetails+3].split(':').slice(1).join(':').slice(0, -1))

}