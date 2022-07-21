const { query } = require("express");

async function getFuturos(start, end) {
    const ingresoDeDineroPorMes = await getIngresoDeDineroPorMes(start, end);
    const montoDeRetiroProbable = await getMontoDeRetiroProbable();

    return {
        ingresoDeDineroPorMes,
        montoDeRetiroProbable,
    }
}

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

module.exports = {
    getFuturos,
}