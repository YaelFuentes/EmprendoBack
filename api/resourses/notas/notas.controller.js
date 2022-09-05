const moment = require("moment");
const { resolve } = require("path");


async function getAllNotas() {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);

  const sql = `SELECT * getNotas FROM notas WHERE creditID = ?;`;
  const notas = await query(sql, []);

  if (notas) {
    return notas;
  } else {
    return [];
  }
}


//agregar notas con post
async function addNotas({
  userID, creditID, notas, USER_ID, fecha
}) {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  try {
    const sql = `INSERT INTO notas (userID, creditID, notas, fecha) VALUES(?, ?, ?, now())`;
    const postNotas = await query(sql, [userID, creditID, notas, USER_ID, fecha]);
    if (postNotas) {
      return util.callbackify(null, postNotas);
    } else {
      return util.callbackify(null, []);
    }
  } catch (err) {
    console.log("error al insertar datos" , err)
    return {
      id : null,
      message: ["error al insertar datos"]
    }
  }
}

module.exports = {
  getAllNotas,
  addNotas
}
