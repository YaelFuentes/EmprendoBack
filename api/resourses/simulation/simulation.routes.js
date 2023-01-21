const express = require("express");
const auth = require("../auth");
const jwt_decode = require("jwt-decode");
const simulationRouter = express.Router();
const simulationController = require("./simulation.controller");

simulationRouter.get('/:userId',async function(req,res) {
  const {userId} = req.params
  const response = await simulationController.getSimulation(userId)
  res.json(response)
})

module.exports = simulationRouter;
