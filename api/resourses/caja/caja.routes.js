const express = require("express");
const cajaController = require('./caja.controller');
const cajaRouter = express.Router();
const auth = require("../auth");


cajaRouter.get("/caja", auth.required, function (req, res){
  cajaController.getCajas()
  .then((data) => {
    res.json(data);
  })
  .catch((err) => {
    console.log(err);
    res.send(500).json({response:"Error el obtener los datos"});
  })
});

cajaRouter.get("/resumecaja", auth.required, function(req, res){
  cajaController.getResumeCaja()
  .then((data) => {
    res.json(data);
  })
  .catch((err) => {
    console.log(err)
    res.send(500).json({response:"Error al obtener datos del /resumecaja"});
  })
});

cajaRouter.post("/updatecaja", auth.required, function(req, res){
  const caja_id = req.body.caja_id

  cajaController.updateCaja(caja_id)
  .then((data) => {
    res.json(data);
  })
  .catch((err) => {
    console.log(err);
    res.send(500).json({response : "Error al updatear los datos en el contolador"})
  })
});

module.exports = cajaRouter;
