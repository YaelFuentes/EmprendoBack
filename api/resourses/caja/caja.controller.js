async function getCajas() {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  let result;
  const sql = 'select * from caja';
  result = await query(sql, [])
  return result
};

//caja que muestra el resume diario de emprendo
/* -------------------------------------------------------------------------- */
/*                          funcion que envia los get                         */
/* -------------------------------------------------------------------------- */
async function getResumeCaja() {
  //resumen diario
  const efectivoDiario = await getEfectivoDiario();
  const brubankDiario = await getBrubankDiario();
  const santanderDiario = await getSantanderDiario();
  //resumen completo 
  const efectivoMayor = await getEfectivoMayor();
  const santanderMayor = await getSantanderMayor();
  const brubankMayor = await getBrubankMayor();
  return{
    efectivoDiario,
    brubankDiario,
    santanderDiario,
    totalResumeDiario : efectivoDiario + brubankDiario + santanderDiario,
    /////////////////
    efectivoMayor,
    santanderMayor,
    brubankMayor,
    totalResumeMayor : efectivoMayor + santanderMayor + brubankMayor,
  }
}



/* -------------------------------------------------------------------------- */
/*                              funcion con query                             */
/* -------------------------------------------------------------------------- */
async function getEfectivoDiario(){
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const dataQuery = "select sum(amount) efectivoDiarioQuery from cayetano.cash_flow where caja_id = '2' and operation_type not in ('pago_cuota_total') and account_id = '1'; ";
  const result = await query(dataQuery, []);
  if (result) {
    return result[0].efectivoDiarioQuery
  } else {
    return 0
  }
}
async function getBrubankDiario() {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const dataQuery = "select sum(amount) brubankDiarioQuery from cayetano.cash_flow where caja_id = '2' and operation_type not in ('pago_cuota_total') and account_id = '5';";
  const result = await query(dataQuery, []);
  if(result) {
    return result[0].brubankDiarioQuery
  } else {
    return 0
  }
}
async function getSantanderDiario() {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const dataQuery = "select sum(amount) santanderDiarioQuery from cayetano.cash_flow where caja_id = '2' and operation_type not in ('pago_cuota_total') and account_id = '8';";
  const result = await query(dataQuery, []);
  if (result) {
    return result[0].santanderDiarioQuery
  } else {
    return 0 
  }
}
async function getEfectivoMayor() {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const dataQuery = "SELECT SUM(amount) efectivoMayorQuery FROM cash_flow WHERE caja_id = '1' AND account_id = '1' and operation_type not in ('pago_cuota_total') ;";
  const result = await query(dataQuery, []);
  if (result ) {
    return result[0].efectivoMayorQuery
  } else {
    return 0
  }
}
async function getSantanderMayor() {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const dataQuery = "SELECT SUM(amount) santanderMayorQuery FROM cash_flow WHERE caja_id = '1' AND account_id = '8' and operation_type not in ('pago_cuota_total') ;";
  const result = await query(dataQuery, []);
  if (result ) {
    return result[0].santanderMayorQuery
  } else {
    return 0
  }
}
async function getSantanderMayor() {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const dataQuery = "SELECT SUM(amount) brubankMayorQuery FROM cash_flow WHERE caja_id = '1' AND account_id = '5' and operation_type not in ('pago_cuota_total') ;";
  const result = await query(dataQuery, []);
  if (result ) {
    return result[0].brubankMayorQuery
  } else {
    return 0
  }
}

/* -------------------------------------------------------------------------- */
/*        se updatea el caja id para que siempre se mande a caja mayor        */
/* -------------------------------------------------------------------------- */
async function updateCaja(caja_id) {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  let result;
  let sql = `UPDATE cash_flow SET caja_id = 2 WHERE caja_id = ?`;
  result = await query(sql, [caja_id]);
  return result;
}



module.exports = {
  getCajas,
  getResumeCaja,
  updateCaja
}