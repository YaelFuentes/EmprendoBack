const { query } = require("express");

async function getFuturos(start, end) {
    const ingresoDeDineroPorMes = await getIngresoDeDineroPorMes(start, end);
    const inversionmensual = await getInversionMensual(start, end);
    const ingresoCapitalSocios = await getDineroMensual(start, end);
    const creditoMensual = await getCreditoMensual(start, end);
    const cuotaCreditoMensual = await getCuotaCreditoMensual(start, end);
    const cuotaInteresMensual = await getInteresPorInversion(start, end);
    const GastoExtraordinario = await getGastoExtraordinario(start, end);

    return {
        ingresoDeDineroPorMes,
        inversionmensual,
        ingresoCapitalSocios,
        creditoMensual,
        cuotaCreditoMensual,
        cuotaInteresMensual,
        GastoExtraordinario,
        total: +inversionmensual + +ingresoCapitalSocios - +creditoMensual
    }
}

//ingreso de dinero por mes
async function getIngresoDeDineroPorMes() {
    const util = require("util"); //consulta que muestra la suma de las inversiones de los inversores vigentes.
    const query = util.promisify(mysqli.query).bind(mysqli);
    const ingresoDineroQuery = `SELECT SUM(amount) InversoresVigentes FROM investments WHERE DATE_ADD(DATE(ts),INTERVAL (period) MONTH) >= DATE(NOW()) AND DATE_ADD(DATE(ts),INTERVAL (period) MONTH) > DATE(NOW());`;
    const ingresoDineroResult = await query(ingresoDineroQuery)
    if(ingresoDineroResult) {
        return ingresoDineroResult[0].InversoresVigentes
    } else {
        return 0;
    }
}

//muestra inversiones mensuales ingresados
async function getInversionMensual(start, end) {
    const util = require("util");
    const query = util.promisify(mysqli.query).bind(mysqli);
    const dataQuery = `SELECT SUM(amount) InversionesMensuales FROM investments WHERE ts BETWEEN ? AND ?;`;
    const result = await query(dataQuery, [start, end])
    if(result){
        return result[0].InversionesMensuales
    } else {
        return 0;
    }
}

//muestra el ingreso de dinero por socios (no inversiones)
async function getDineroMensual(start, end){
    const util = require("util");
    const query = util.promisify(mysqli.query).bind(mysqli);
    const dataQuery = `SELECT SUM(amount) DineroCapitalSocios FROM cash_flow WHERE description = ('Capital - Socios Valdez') AND created_at BETWEEN ? AND ?;`;
    const result = await query(dataQuery, [start, end])
    if(result){
        return result[0].DineroCapitalSocios
    }else{
        return 0;
    }
}

//muestra el credito saliente mas el gasto de otorgamiento mensual
async function getCreditoMensual(start, end){
    const util = require("util");
    const query = util.promisify(mysqli.query).bind(mysqli);
    const dataQuery = `SELECT SUM(capital) CreditoMensualMonto FROM credits WHERE otorgamiento BETWEEN ? AND ?;`;
    const result = await query(dataQuery, [start, end])
    if(result){
        return result[0].CreditoMensualMonto
    }else{
        return 0;
    }
}

//muestra el monto de la cuota de los creditos mas punitorios mas intereses mas gastos de otorgamiento por mes.
async function getCuotaCreditoMensual(start, end){
    const util = require("util");
    const query = util.promisify(mysqli.query).bind(mysqli);
    const dataQuery = `SELECT SUM(amount + punitorios) CreditoMensualCuota FROM cayetano.credits_items where period BETWEEN ? AND ?;`;
    const result = await query(dataQuery, [start, end])
    if(result){
        return result[0].CreditoMensualCuota
    }else{
        return 0;
    }
}

//muestra el interes generado mes a mes por las inversiones totales. 
async function getInteresPorInversion(start, end){
    const util = require("util");
    const query = util.promisify(mysqli.query).bind(mysqli);
    const dataQuery = `SELECT SUM(amount) InteresPorInversion FROM investments_payments WHERE ts BETWEEN ? AND ?;`;
    const result = await query(dataQuery, [start, end])
    if(result){
        return result[0].InteresPorInversion
    }else{
        return 0;
    }
}

//muestra los gastos extraordinarios mensuales
async function getGastoExtraordinario(start, end){
    const util = require("util");
    const query = util.promisify(mysqli.query).bind(mysqli);
    const dataQuery = `SELECT SUM(amount) GastoExtrao FROM cash_flow WHERE description LIKE 'Gasto Ext%' AND created_at BETWEEN ? AND ?;`;
    const result = await query(dataQuery, [start, end])
    if(result){
        return result[0].GastoExtrao
    }else{
        return 0;
    }
}

async function getGastoOrdinario(start, end){
    const util = require("util");
    const query = util.promisify(mysqli.query).bind(mysqli);
    const dataQuery = `SELECT * FROM cayetano.cash_flow WHERE description LIKE 'Gasto Ext%'  ;`;
    const result = await query(dataQuery, [start, end])
    if(result){
        return result[0].GastoOrdi
    }else{
        return 0;
    }
}

module.exports = {
    getFuturos,
}