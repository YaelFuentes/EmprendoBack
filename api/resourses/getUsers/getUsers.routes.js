/* const express = require("express");
const getUsersController = require("./getUsers.controller");
const getUsersRouter = express.Router();
const auth = require('../auth');


getUsersRouter.get("/", auth.required, function (req, res, next) {
  const start = req.body.start;
  const end = req.body.end;

  getUsersController
    .getUsers(start,end)
    .then((data) => {
      res.json(data);
    })
    .catch((err) => {
      console.log(err);
      res.send(500).json({response:"Error al obtener datos"})
    });
});
module.exports = getUsersRouter */