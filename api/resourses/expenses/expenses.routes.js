const express = require("express");
const auth = require("../auth");
const jwt_decode = require("jwt-decode");
const expenseController = require("./expenses.controller.js")
const expenseRouter = express.Router();


expenseRouter.post('/payment/:userId',auth.required,async function(req,res) {
  //if creditInfo is present then its simulator function. CreditId is not present
  //if CreditId is present then its creditpayment. creditInfo is not present
  const decoded = jwt_decode(auth.getToken(req));
  const USER_ID = decoded.id;
  let {userId} = req.params
  userId = Number(userId)
  const {pagos,taxes,creditInfo,creditId} = req.body
  if(creditInfo!=undefined) {
    await expenseController.addExpenses(taxes,userId,creditInfo)
  }
  const response = await expenseController.addMultipleExpensesPayment(pagos,taxes,userId,USER_ID,Number(creditId))
  await expenseController.updateExpenses(response,userId,Number(creditId))
  res.json(response)
})
expenseRouter.get('/:userId',auth.required,async function(req,res) {
  const {userId} = req.params
  const response = await expenseController.getExpenses(userId)
  res.json(response)
})

module.exports = expenseRouter;
