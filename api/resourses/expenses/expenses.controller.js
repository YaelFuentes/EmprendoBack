const addExpenses = async (expenses,credit_id) => {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  try {
    expenses.map(async item=>{
      if(item.amount>0){
      const sql = "insert into cayetano.expenses (description, amount, credit_id) values (?,?,?)"
      let result =await query(sql,[item.name,item.amount,credit_id])
      return result
      }
      return
    })
  } catch (error) {
    return error
  }

}

module.exports = {
  addExpenses
}