const addExpenses = async (expenses, userID,creditInfo) => {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  try {
    const simulation = await query("select * from simulation where user_id = ?",[userID])
    if (simulation.length > 0) {
      await query("update cayetano.simulation set simulation_amount = ? , quotes = ? , commision_id = ? , viatic = ? , created_at = now(), imported = ? where id =?"
      ,[Number(creditInfo.amount),Number(creditInfo.quotes),creditInfo.rateOfInterest,creditInfo.viatic,creditInfo.imported,simulation[0].id]);
    }else{
      await query("insert into cayetano.simulation (simulation_amount,quotes,commision_id,viatic,imported,updated_at,user_id) values (?,?,?,?,?,now(),?)"
      ,[Number(creditInfo.amount),Number(creditInfo.quotes),creditInfo.rateOfInterest,creditInfo.viatic,creditInfo.imported,userID])

    }
    const getExpenses = await query("select * from expenses where credit_id is null AND client_id = ?",[userID])
    if(getExpenses.length > 0) {
      getExpenses.map(async item=>{
          const newTax = expenses.filter(expense=>expense.id === item.tax_id)
          let taxId = item.id
          let taxAmount = 0
          if (newTax.length > 0) {
            taxAmount = newTax[0].amount
          }
          const sql = "update cayetano.expenses set amount = ? where id = ? "
          let result =await query(sql,[taxAmount,taxId])
          return result
      }) 
    }else{
    expenses.map(async item=>{
      let taxId = item.id
      if (!item.id) {
        taxId = 100
      }
      const sql = "insert into cayetano.expenses (description, amount,tax_id,client_id) values (?,?,?,?)"
      let result =await query(sql,[item.name,item.amount,taxId,userID])
      return result
    })
  }
  } catch (error) {
    return error
  }

}
const addMultipleExpensesPayment = async (pagos,taxes,userId,USER_ID,creditId) => {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  try {
   let taxesChecked = taxes.filter(item=>item.checked===true)
   let payedArray = []
   let insertPaymentArray = [] 
   pagos.map( pago=>{
    let montoTotal = Number(pago.monto)
     taxesChecked.map( tax=>{
      if(montoTotal === 0) return
      let pagado
      let processed = 0
      let taxAmount = Number((tax.amount).toFixed(2))
      const itemPayed = payedArray.filter(item => item.id === tax.id)
      const restTaxAmount = Number((taxAmount - (itemPayed.length > 0 ? itemPayed[0].pagado : 0)).toFixed(2))
      if (Array.isArray(itemPayed) && itemPayed.length > 0 ){
        if (itemPayed[0].pagado >= taxAmount) return
      } 
      if(montoTotal > 0 && montoTotal === restTaxAmount){
        insertPaymentArray.push({amount:restTaxAmount,description: tax.name,accountId: pago.accountID})
        montoTotal = 0
        pagado = restTaxAmount
      }
      if (montoTotal > 0 && restTaxAmount < montoTotal ){
        insertPaymentArray.push({amount:restTaxAmount,description: tax.name,accountId: pago.accountID})
        pagado = restTaxAmount
        montoTotal = montoTotal - restTaxAmount  
        processed = 1
      }
      if (montoTotal > 0 && restTaxAmount > montoTotal && processed == 0){
        insertPaymentArray.push({amount:montoTotal,description: tax.name,accountId: pago.accountID})
        pagado = montoTotal
        montoTotal = 0
      } 
      if(pagado > 0 ){
        const findPayed = payedArray.findIndex(item => item.id === tax.id)
        if (findPayed != -1) {
          const modifiedArray = payedArray.map(item => {
            if(item.id === tax.id){
              return {...item, pagado: item.pagado+ pagado}
            }
            return item
          })
          payedArray = modifiedArray
        } else {
          payedArray.push({id:tax.id , pagado: pagado })
        }
      }
    })
   })
   if (creditId) {
     const sql = `insert into cayetano.cash_flow (type,amount,created_at,description,operation_type,account_id,caja_id,user,responsable_id,credit_id) values (2,?,now(),?,"gasto_otorgamiento",?,1,?,?,?)`
       insertPaymentArray.map(async payedItem =>{
        await query(sql,[-Number(payedItem.amount),payedItem.description,payedItem.accountId,userId,USER_ID,creditId])
      })
   }else{
     const sql = `insert into cayetano.cash_flow (type,amount,created_at,description,operation_type,account_id,caja_id,user,responsable_id) values (2,?,now(),?,"gasto_otorgamiento",?,1,?,?)`
       insertPaymentArray.map(async payedItem =>{
        await query(sql,[-Number(payedItem.amount),payedItem.description,payedItem.accountId,userId,USER_ID])
      })
   }
  
    return payedArray
  } catch (error) {
    return error
  }

}
const updateExpenses =async (payedArray,userId,creditId) => {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  if(creditId){
    payedArray.map(async tax =>{
      await query("update cayetano.expenses set payed=?, credit_id = ? where id = ?",[tax.pagado,creditId,tax.id])
     })
  }else{
    payedArray.map(async tax =>{
      await query("update cayetano.expenses set payed=? where credit_id is null and client_id = ? and tax_id = ?",[tax.pagado,userId,tax.id])
     })
  }
  return
}
const assignCreditId = async (expenses,userId, creditId) => {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  try {
    /* -------------------------------------------------------------------------- */
    /*                               updateExpenses                               */
    /* -------------------------------------------------------------------------- */
    const getExpenses = await query("select * from expenses where credit_id is null AND client_id = ?",[userId])
    if(getExpenses.length > 0) {
      getExpenses.map(async item=>{
          const newTax = expenses.filter(expense=>expense.id === item.tax_id)
          let expenseId = item.id
          console.log(newTax,expenseId);
          const sql = "update cayetano.expenses set credit_id = ? where id = ? "
          await query(sql,[creditId,expenseId])
      }) 
    }
    /* -------------------------------------------------------------------------- */
    /*                              updateSimulation                              */
    /* -------------------------------------------------------------------------- */
    const getSimulation = await query("select * from cayetano.simulation where user_id = ?",[userId])
    if(getSimulation.length > 0) {
      const sqlSimulation = "update cayetano.simulation set simulation_amount = null,quotes = null, commision_id = null, viatic = null, imported = 1, updated_at=now() where user_id = ? "
      await query(sqlSimulation,[userId])
    }
    /* -------------------------------------------------------------------------- */
    /*                               updateCashFlow                               */
    /* -------------------------------------------------------------------------- */
    const getCashFlow = await query(`select * from cayetano.cash_flow where user=? and operation_type="gasto_otorgamiento" and credit_id is null`,[userId])
    if (getCashFlow.length>0) {
      const getIds = getCashFlow.map(item=>item.id)
      await query(`update cayetano.cash_flow set credit_id =? where id in(?)`,[creditId,getIds])
    }
    return
  } catch (error) {
    return error
  }

}
const getExpenses = (userId) => {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  try {
    const response = query ("select * from cayetano.expenses where client_id = ? and credit_id is null",[userId])
    return response
  } catch (error) {
    return error
  }
}
module.exports = {
  addExpenses,
  addMultipleExpensesPayment,
  updateExpenses,
  getExpenses,
  assignCreditId
}