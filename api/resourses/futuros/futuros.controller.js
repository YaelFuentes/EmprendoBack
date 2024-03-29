const { query } = require("express");
const moment = require("moment");

async function getFuturos(start, end) {
  
  start = moment(start).format("YYYY/MM/DD 00:00:00")
  end = moment(end).format("YYYY/MM/DD 23:59:59")
  console.log(start, end );
  //Inversiones
  const totalCapitalInversiones = await getTotalCapitalInversiones();
  const totalCapitalInversionesMensual = await getTotalCapitalInversionesMensual(
    start,
    end
  );
  const totalAPagarInversionesMesActual =
    await getTotalAPagarInversionesMesActual();
  const inversionesARetirarConInteresesPagados =
    await getInversionesARetirarConInteresesPagados();
  //Creditos
  const totalCreditosOtorgadosCapital = await getTotalCreditosOtorgadosCapital(
    start,
    end
  );
  const totalCreditosOtorgadosNotaCredito= await getTotalCreditosOtorgadosNotasCredito(
    start,
    end
  );
  const totalCreditosOtorgadosCapitalIntereses =
  await getTotalCreditosOtorgadosCapitalIntereses(start, end);
  const totalCreditosOtorgadosCapitalInteresesGO =
  await getTotalCreditosOtorgadosCapitalInteresesGO(start, end);
  const totalGastosOtorgamiento = await getTotalGastosOtorgamiento(start, end);
  await getTotalCreditosOtorgadosCapitalInteresesGO(start, end);
  const totalDeudaCreditosMora = await getTotalDeudaCreditosMora();
  const totalDeudaCreditosJuicio = await getTotalDeudaCreditosJuicio();
  const totalACobrar = await getTotalACobrar(start, end);
  const totalACobrarCapitalIntereses = await getTotalACobrarCapitalIntereses(start, end);
  const totalACobrarSeguros= await getTotalACobrarSeguros(start, end);
  const totalACobrarPunitorios= await getTotalACobrarPunitorios(start, end);
  const totalCobrado = await getTotalCobrado(start, end);
  const totalCobradoCapitalIntereses = await getTotalCobradoCapitalInteres(start, end);
  const totalCobradoSeguro = await getTotalCobradoSeguro(start, end);
  const totalCobradoPunitorios = await getTotalCobradoPunitorios(start, end);
  const totalCreditosCapitalGO = totalGastosOtorgamiento + totalCreditosOtorgadosCapital
  const totalHistoricoCapitalGO = await getTotalHistoricoCapitalGO()
  const totalHistoricoCapitalGOJuicio = await getTotalHistoricoCapitalGOJuicio()
  const totalHistoricoCapitalGOInactivos = await getTotalHistoricoCapitalGOInactivos()
  const saldoRestanteCapitalHistorico = await getSaldoRestanteCapitalHistorico()
  //Caja
  const totalEgresoSinInversiones = await getTotalEgresoSinInversiones(start, end);
  const totalEgresoConInversiones = await getTotalEgresoConInversiones(start, end);
  const totalEgresosFijos = await getEgresosFijos(start, end);

  return {
    totalCapitalInversiones,
    totalCapitalInversionesMensual,
    totalAPagarInversionesMesActual,
    inversionesARetirarConInteresesPagados,
    totalCreditosOtorgadosCapital,
    totalCreditosOtorgadosNotaCredito,
    totalCreditosOtorgadosCapitalIntereses,
    totalCreditosOtorgadosCapitalInteresesGO,
    saldoRestanteCapitalHistorico,
    totalGastosOtorgamiento,
    totalDeudaCreditosMora,
    totalDeudaCreditosJuicio,
    totalACobrar,
    totalACobrarCapitalIntereses,
    totalACobrarSeguros,
    totalACobrarPunitorios,
    totalCobrado,
    totalCobradoCapitalIntereses,
    totalCobradoSeguro,
    totalCobradoPunitorios,
    totalCreditosCapitalGO,
    totalHistoricoCapitalGO,
    totalHistoricoCapitalGOJuicio,
    totalHistoricoCapitalGOInactivos,
    totalEgresoSinInversiones,
    totalEgresoConInversiones,
    totalEgresosFijos
  };
}
/* -------------------------------------------------------------------------- */
/*                                 Inversiones                                */
/* -------------------------------------------------------------------------- */
// Total Capital de inversiones
async function getTotalCapitalInversiones() {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const dataQuery = `select  percentage, ts, period, sum(amount) as capitalInversiones from cayetano.investments where now() between ts and date_add(ts, interval period month) ;  `;
  const result = await query(dataQuery, []);
  if (result) {
    return result[0].capitalInversiones
  } else {
    return 0;
  }
}
// Total inversiones ingresadas del mes
async function getTotalCapitalInversionesMensual(start, end) {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const dataQueryIngreso = `select  percentage, ts, period,(case when sum(B.amount) is null then 0 else sum(B.amount) end) as inversionesCapital 
  from cayetano.investments A inner join cash_flow B on A.id= B.investment_id 
  where operation_type in( 'inversion_nueva') and created_at between ? and ?;`;
  const dataQueryEgreso = `select  percentage, ts, period,(case when sum(B.amount) is null then 0 else abs(sum(B.amount)) end) as inversionesCapital 
  from cayetano.investments A inner join cash_flow B on A.id= B.investment_id 
  where operation_type in( 'retiro_inversion') and created_at between ? and ?;`;
  const resultIngreso = await query(dataQueryIngreso, [start, end]);
  const resultEgreso = await query(dataQueryEgreso, [start, end]);
  if (dataQueryIngreso) {
    return resultIngreso[0].inversionesCapital - resultEgreso[0].inversionesCapital
  } else {
    return 0;
  }
}
// Total que tengo q pagar de intereses mes actual
async function getTotalAPagarInversionesMesActual() {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const dataQuery = `select  percentage, ts, period, sum(amount * (percentage / 100))as pagoMensual from cayetano.investments where now() between ts and date_add(ts, interval period month) and recapitalizacion_status = 0 ;`;
  const result = await query(dataQuery, []);
  if (result) {
    return result[0].pagoMensual;
  } else {
    return 0;
  }
}
// Inversiones a retirar con todos los intereses ya pagados (vencidas)
async function getInversionesARetirarConInteresesPagados() {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const dataQuery = `Select sum(A.amountTotal) as total from (SELECT  cast(date_add(I.ts, interval I.period month) as date) as finalDate , I.ts,I.id as investment_id,
  I.period ,sum(I.amount) as amountTotal,((I.amount * (I.percentage / 100))*I.period) as sumaIntereses,abs(sum(C.amount)) as sumaPagos
 FROM cayetano.investments I inner join cayetano.cash_flow C on I.id = C.investment_id
 where C.operation_type in ("pago_inversion") and cast(date_add(I.ts, interval I.period month) as date) < DATE_SUB(now(),INTERVAL DAYOFMONTH(now())-1 DAY) 
 and I.id not in ( select CSH.investment_id from cayetano.cash_flow CSH where operation_type="retiro_inversion")
  Group by C.investment_id having sumaIntereses = sumaPagos ) A;`;
  const result = await query(dataQuery, []);
  if (result) {
    return result[0].total;
  } else {
    return 0;
  }
}

/* -------------------------------------------------------------------------- */
/*                                  Creditos                                  */
/* -------------------------------------------------------------------------- */
// Otorgados: capital
async function getTotalCreditosOtorgadosCapital(start, end) {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const dataQuery = `SELECT SUM(credit_amount) as amount  FROM cayetano.credits WHERE otorgamiento BETWEEN ? AND ? and status = 1;`;
  const result = await query(dataQuery, [start, end]);
  if (result) {
    return result[0].amount;
  } else {
    return 0;
  }
}
// Otorgados: NOTAS DE CRÉDITO
async function getTotalCreditosOtorgadosNotasCredito(start, end) {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const dataQuery = `SELECT sum(amount) as amount FROM cayetano.payments where account_id=12 and paymentDate between ? and ?;`;
  const result = await query(dataQuery, [start, end]);
  if (result) {
    return result[0].amount;
  } else {
    return 0;
  }
}
// Otorgados: capital + intereses
async function getTotalCreditosOtorgadosCapitalIntereses(start, end) {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const dataQuery = `SELECT SUM(credit_amount+intereses) as amount  FROM cayetano.credits WHERE otorgamiento BETWEEN ? AND ? and status = 1;`;
  const result = await query(dataQuery, [start, end]);
  if (result) {
    return result[0].amount;
  } else {
    return 0;
  }
}
// Otorgados: capital + intereses + Gastos de otorgamiento
async function getTotalCreditosOtorgadosCapitalInteresesGO(start, end) {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const dataQuery = `SELECT SUM(capital+intereses) as amount  FROM cayetano.credits WHERE otorgamiento BETWEEN ? AND ? and status = 1;`;
  const result = await query(dataQuery, [start, end]);
  console.log(result);

  if (result) {
    return result[0].amount;
  } else {
    return 0;
  }
}
// Otorgados: GO
async function getTotalGastosOtorgamiento(start, end) {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const dataQuery = `SELECT SUM(A.capital-A.credit_amount)  amountT  FROM cayetano.credits A WHERE otorgamiento  BETWEEN ? and ? and status = 1;`
  const result = await query(dataQuery, [start, end]);
  console.log(result[0].amountT);
  if (result) {
    return result[0].amountT;
  } else {
    return 0;
  }
}

// Monto deuda creditos en mora
async function getTotalDeudaCreditosMora() {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const dataQuery = `SELECT 
  SUM(A.deudas) AS deudas, A.dias, A.id
FROM
  (SELECT 
  c.id,
      c.clientID,
      ci.period,
      coalesce(ci.capital + ci.intereses + punitorios + safe + nota_debito +  - ci.payed , 0) AS deudas,
      DATEDIFF(NOW(), ci.period) AS dias
FROM
  cayetano.punitorios p
RIGHT JOIN cayetano.credits_items ci ON ci.credit_id = p.credit_id
  AND MONTH(p.period) = MONTH(ci.period)
  AND YEAR(p.period) = YEAR(ci.period)
INNER JOIN cayetano.credits c ON c.id = ci.credit_id
WHERE
  1 AND ci.period < NOW() AND c.status=1 AND c.state IN ('4','0','5','6','2') IS NOT TRUE
GROUP BY ci.credit_id , ci.period , c.id
HAVING deudas > 0
ORDER BY c.clientID , ci.period) A`;
  const result = await query(dataQuery, []);
  if (result) {
    return result[0].deudas;
  } else {
    return 0;
  }
}
// Monto deuda creditos en juicio
async function getTotalDeudaCreditosJuicio() {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const dataQuery = `SELECT sum(A.amount+A.safe+A.punitorios+A.nota_debito-A.payed) deuda,B.status,B.state, A.credit_id FROM cayetano.credits_items A inner join cayetano.credits B on A.credit_id=B.id where B.state = 4 and B.status= 1`;
  const result = await query(dataQuery, []);
  if (result) {
    return result[0].deuda;
  } else {
    return 0;
  }
}
// Total a cobrar
async function getTotalACobrar(start, end) {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const dataQuery = `SELECT credit_id,SUM(A.amount + A.safe + A.nota_debito + A.punitorios)- SUM(A.payed) as deudaTotal FROM cayetano.credits_items A INNER JOIN cayetano.credits B ON A.credit_id = B.id 
    WHERE B.state IN ('2','4','5','6') IS NOT TRUE AND A.payed < (A.amount + A.safe + A.punitorios + A.nota_debito ) AND period BETWEEN ? AND ? ;`;
  const result = await query(dataQuery, [start, end]);
  if (result) {
    return result[0].deudaTotal;
  } else {
    return 0;
  }
}
// Total a cobrar capital + intereses sin contar lo pagado
async function getTotalACobrarCapitalIntereses(start, end) {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const dataQuery = `SELECT credit_id,coalesce(sum(A.capital+ A.intereses),0) aCobrar FROM cayetano.credits_items A INNER JOIN cayetano.credits B ON A.credit_id = B.id 
  WHERE B.status=1 and B.state IN ('2','4','5','6') IS NOT TRUE AND period BETWEEN ? AND ?;`;
  const result = await query(dataQuery, [start, end]);
  if (result) {
    return result[0].aCobrar;
  } else {
    return 0;
  }
}
// Total a cobrar seguro sin contar lo pagado
async function getTotalACobrarSeguros(start, end) {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const dataQuery = `SELECT credit_id,coalesce(SUM(A.safe),0) aCobrar FROM cayetano.credits_items A INNER JOIN cayetano.credits B ON A.credit_id = B.id 
  WHERE B.status=1 and B.state IN ('2','4','5','6') IS NOT TRUE AND period BETWEEN ? AND ?;`;
  const result = await query(dataQuery, [start, end]);
  if (result) {
    return result[0].aCobrar;
  } else {
    return 0;
  }
}
// Total a cobrar punitorios sin contar lo pagado
async function getTotalACobrarPunitorios(start, end) {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const dataQuery = `SELECT credit_id,coalesce(SUM(A.punitorios),0) aCobrar FROM cayetano.credits_items A INNER JOIN cayetano.credits B ON A.credit_id = B.id 
  WHERE B.status=1 and B.state IN ('2','4','5','6') IS NOT TRUE AND period BETWEEN ? AND ?;`;
  const result = await query(dataQuery, [start, end]);
  if (result) {
    return result[0].aCobrar;
  } else {
    return 0;
  }
}
// Total cobrado
async function getTotalCobrado(start, end) {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const dataQuery = `SELECT sum(amount) AS total FROM cayetano.cash_flow WHERE operation_type IN ('ingreso_seguro_cuotas','ingreso_interes_cuotas','ingreso_capital_cuotas','ingreso_punitorios_cuotas') AND created_at
    BETWEEN ? AND ?;`;
  const result = await query(dataQuery, [start, end]);
  if (result) {
    return result[0].total;
  } else {
    return 0;
  }
}
// Total cobrado capital + interes
async function getTotalCobradoCapitalInteres(start, end) {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const dataQuery = `  SELECT sum(A.amount) AS total,A.created_at,A.operation_type,C.* FROM cayetano.cash_flow A 
  inner join  cayetano.credits B on A.credit_id = B.id 
  inner join cayetano.credits_items C on A.credit_item_id = C.id
  WHERE B.status = 1 and  A.operation_type in ('ingreso_interes_cuotas','ingreso_capital_cuotas') AND C.period
    BETWEEN ? AND ? and B.state IN ('2','4','5','6') IS NOT TRUE;`;
  const result = await query(dataQuery, [start, end]);
  if (result) {
    return result[0].total;
  } else {
    return 0;
  }
}
// Total cobrado seguro 
async function getTotalCobradoSeguro(start, end) {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const dataQuery = `      
  SELECT sum(A.amount) AS total,A.created_at,A.operation_type,C.* FROM cayetano.cash_flow A 
inner join  cayetano.credits B on A.credit_id = B.id 
inner join cayetano.credits_items C on A.credit_item_id = C.id
WHERE B.status = 1 and  A.operation_type in ('ingreso_seguro_cuotas') AND C.period
  BETWEEN ? AND ? and B.state IN ('2','4','5','6') IS NOT TRUE;`;
  const result = await query(dataQuery, [start, end]);
  if (result) {
    return result[0].total;
  } else {
    return 0;
  }
}
// Total cobrado punitorios 
async function getTotalCobradoPunitorios(start, end) {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const dataQuery = `SELECT sum(A.amount) AS total,A.created_at,A.operation_type,C.* FROM cayetano.cash_flow A 
  inner join  cayetano.credits B on A.credit_id = B.id 
  inner join cayetano.credits_items C on A.credit_item_id = C.id
  WHERE B.status = 1 and  A.operation_type in ('ingreso_punitorios_cuotas') AND C.period
    BETWEEN ? AND ? and B.state IN ('2','4','5','6') IS NOT TRUE;`;
  const result = await query(dataQuery, [start, end]);
  if (result) {
    return result[0].total;
  } else {
    return 0;
  }
}

// total historico capital + G.Otorgamiento
async function getTotalHistoricoCapitalGO() {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const dataQuery = `SELECT SUM(A.capital) amount FROM cayetano.credits A WHERE state in (4,2) is not true and status = 1;`;
  const result = await query(dataQuery, []);
  if (result) {
    return result[0].amount;
  } else {
    return 0;
  }
}
// total historico capital + G.Otorgamiento para creditos en juicio
async function getTotalHistoricoCapitalGOJuicio() {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const dataQuery = `SELECT SUM(A.capital) amount FROM cayetano.credits A WHERE state = 4 and status = 1;`;
  const result = await query(dataQuery, []);
  if (result) {
    return result[0].amount;
  } else {
    return 0;
  }
}
// total historico capital + G.Otorgamiento para creditos inactivos
async function getTotalHistoricoCapitalGOInactivos() {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const dataQuery = `SELECT SUM(A.capital) amount FROM cayetano.credits A WHERE state = 2 and status = 1;`;
  const result = await query(dataQuery, []);
  if (result) {
    return result[0].amount;
  } else {
    return 0;
  }
}
// total historico capital + G.Otorgamiento - pagado
async function getSaldoRestanteCapitalHistorico() {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const dataQuery = `SELECT COALESCE(sum(B.capital),0) as amount  FROM cayetano.credits A inner join cayetano.credits_items B on B.credit_id = A.id  WHERE status = 1;`;
  const result = await query(dataQuery, []);
  const dataQuery2 = `SELECT COALESCE(sum(B.amount),0) as amount  FROM cayetano.credits A inner join cayetano.cash_flow B on A.id = B.credit_id WHERE operation_type="ingreso_capital_cuotas" and status = 1;`;
  const result2 = await query(dataQuery2, []);
  if (result) {
    return result[0].amount - result2[0].amount;
  } else {
    return 0;
  }
}

/* -------------------------------------------------------------------------- */
/*                                    Caja                                    */
/* -------------------------------------------------------------------------- */
// Egreso sin pago de inversion
async function getTotalEgresoSinInversiones(start, end) {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const dataQuery = `SELECT abs(sum(amount)) as egreso FROM cayetano.cash_flow WHERE type = 2 AND created_at BETWEEN ? and ? and caja_id = 1 and deleted_at is null and operation_type in ('pago_inversion') is not true;`;
  const result = await query(dataQuery, [start, end]);
  if (result) {
    return result[0].egreso;
  } else {
    return 0;
  }
}
// Egreso con pago de inversion
async function getTotalEgresoConInversiones(start, end) {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const dataQuery = `SELECT abs(sum(amount)) as egreso FROM cayetano.cash_flow WHERE type = 2 AND created_at BETWEEN ? and ? and caja_id = 1 and deleted_at is null;`;
  const result = await query(dataQuery, [start, end]);
  if (result) {
    return result[0].egreso;
  } else {
    return 0;
  }
}
// Egreso fijos
async function getEgresosFijos(start, end) {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const dataQuery = `SELECT COALESCE(abs(sum(amount)),0) as amount FROM cayetano.cash_flow where type = 2 and created_at between ? and ? and deleted_at is null 
  and operation_type in ("Comision_mantenimiento","IIBB_creditos","imp_creditos_debitos","IVA","gastos_impuestos","impuesto_luz","impuesto_agua","impuesto_gas","alquiler_oficina","amortizacion_capital",
  "gastos_cochera","gastos_cafeteria","gastos_agua","gastos_limpieza","gastos_monitoreo_alarma","gasto_telefonia","gastos_celular","gastos_generales","impuesto_inmobiliario",
  "insumos_libreria","insumos_oficina","publicidad_propaganda","sueldo_aguinaldo", "sueldos","egreso_servers","egreso_web","gastos_tasa_impuestos");`;
  const result = await query(dataQuery, [start, end]);
  if (result) {
    return result[0].amount;
  } else {
    return 0;
  }
}

//ingreso de dinero por mes
// async function getIngresoDeDineroPorMes() {
//     const util = require("util"); //consulta que muestra la suma de las inversiones de los inversores vigentes.
//     const query = util.promisify(mysqli.query).bind(mysqli);
//     const ingresoDineroQuery = `SELECT SUM(amount) InversoresVigentes FROM investments WHERE DATE_ADD(DATE(ts),INTERVAL (period) MONTH) >= DATE(NOW()) AND DATE_ADD(DATE(ts),INTERVAL (period) MONTH) > DATE(NOW());`;
//     const ingresoDineroResult = await query(ingresoDineroQuery)
//     if(ingresoDineroResult) {
//         return ingresoDineroResult[0].InversoresVigentes
//     } else {
//         return 0;
//     }
// }

//muestra el ingreso de dinero por socios (no inversiones)
// async function getDineroMensual(start, end){
//     const util = require("util");
//     const query = util.promisify(mysqli.query).bind(mysqli);
//     const dataQuery = `SELECT SUM(amount) DineroCapitalSocios FROM cash_flow WHERE description = ('Capital - Socios Valdez') AND created_at BETWEEN ? AND ?;`;
//     const result = await query(dataQuery, [start, end])
//     if(result){
//         return result[0].DineroCapitalSocios
//     }else{
//         return 0;
//     }
// }

//muestra el credito saliente mas el gasto de otorgamiento mensual
// async function getCreditoMensual(start, end){
//     const util = require("util");
//     const query = util.promisify(mysqli.query).bind(mysqli);
//     const dataQuery = `SELECT SUM(capital) CreditoMensualMonto FROM credits WHERE otorgamiento BETWEEN ? AND ?;`;
//     const result = await query(dataQuery, [start, end])
//     if(result){
//         return result[0].CreditoMensualMonto
//     }else{
//         return 0;
//     }
// }

//muestra el monto de la cuota de los creditos mas punitorios mas intereses mas gastos de otorgamiento por mes.
// async function getCuotaCreditoMensual(start, end){
//     const util = require("util");
//     const query = util.promisify(mysqli.query).bind(mysqli);
//     const dataQuery = `SELECT SUM(amount ) CreditoMensualCuota FROM cayetano.credits_items where period BETWEEN ? AND ?;`;
//     const result = await query(dataQuery, [start, end])
//     if(result){
//         return result[0].CreditoMensualCuota
//     }else{
//         return 0;
//     }
// }

//muestra el interes generado mes a mes por las inversiones totales.
// async function getInteresPorInversion(start, end){
//     const util = require("util");
//     const query = util.promisify(mysqli.query).bind(mysqli);
//     const dataQuery = `SELECT SUM(amount) InteresPorInversion FROM investments_payments WHERE ts BETWEEN ? AND ?;`;
//     const result = await query(dataQuery, [start, end])
//     if(result){
//         return result[0].InteresPorInversion
//     }else{
//         return 0;
//     }
// }

//muestra los gastos extraordinarios mensuales
// async function getGastoExtraordinario(start, end){
//     const util = require("util");
//     const query = util.promisify(mysqli.query).bind(mysqli);
//     const dataQuery = `SELECT SUM(amount) GastoExtrao FROM cash_flow WHERE description LIKE 'Gasto Ext%' AND created_at BETWEEN ? AND ?;`;
//     const result = await query(dataQuery, [start, end])
//     if(result){
//         return result[0].GastoExtrao
//     }else{
//         return 0;
//     }
// }

module.exports = {
  getFuturos,
};
