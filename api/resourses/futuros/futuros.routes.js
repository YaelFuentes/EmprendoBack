const express = require("express");
const futurosController = require("./futuros.controller");
const futurosRouter = express.Router();
const auth = require("../auth");

futurosRouter.post("/futuros", auth.required, function (req, res, next) {
  const start = req.body.start;
  const end = req.body.end;

  futurosController
    .getFuturos(start, end)
    .then((data) => {
      return res.json(data)
    })
    .catch((error) => {
      console.log(error)
      return res.send(500).json({ response: "Error al obtener los datos" })
    })
});

futurosRouter.post("/static", auth.required, function (req, res, next) {
  const start = req.body.start;
  const end = req.body.end;

  futurosController
    .staticFuturos(start, end)
    .then(data => {
      return res.json(data).status(200)
    })
    .catch(error => {
      console.log(error)
      return res.send(500).json({ response: "Error al obtener los datos" })
    })
});

futurosRouter.post("/staticInversion", auth.required, function (req, res, next) {
  const start = req.body.start;
  const end = req.body.end;

  futurosController
    .staticInversion(start, end)
    .then(data => {
      return res.json(data).status(200)
    })
    .catch(error => {
      console.log(error)
      return res.send(500).json({ response: "Error al obtener los datos" })
    })
});

module.exports = futurosRouter;
