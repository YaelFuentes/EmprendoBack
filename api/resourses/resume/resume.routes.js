const express = require("express");
const resumeController = require("./resume.controller");
const resumeRouter = express.Router();
const auth = require("../auth");

resumeRouter.post("/financial", auth.required, function (req, res, next) {
  const start = req.body.start;
  const end = req.body.end;

  resumeController
    .getFinancial(start, end)
    .then((data) => {
      res.json(data);
    })
    .catch((error) => {
      console.log(error);
      res.send(500).json({ response: "Error al obtener los datos" });
    });
});

resumeRouter.post("/financial2", auth.required, function(req, res, next){
  const start = req.body.start;
  const end = req.body.end;
  
  resumeController
  .getFinancial2(start, end)
  .then((data) => {
    res.json(data);
  })
  .catch((error) => {
    console.log(error);
    res.send(500).json ({response : 'error al obtener los datos'})
  })
})

resumeRouter.post("/clients", auth.required, function (req, res, next) {
  const start = req.body.start;
  const end = req.body.end;
  resumeController
    .getResumeClients(start, end)
    .then((data) => {
      res.json(data);
    })
    .catch((error) => {
      res.send(500).json({ response: "Error al obtener los datos" });
    });
});

resumeRouter.post("/investments", auth.required, function (req, res, next) {
  const start = req.body.start;
  const end = req.body.end;
  resumeController
    .getResumeInvestments(start, end)
    .then((data) => {
      res.json(data);
    })
    .catch((error) => {
      res.send(500).json({ response: "Error al obtener los datos" });
    });
});
module.exports = resumeRouter;
